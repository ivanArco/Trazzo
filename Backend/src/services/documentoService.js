// Reglas de negocio de los documentos digitalizados:
// validar la foto, guardarla, leerla con OCR, vincularla al viaje y llevar la revisión con su bitácora.
import crypto from 'node:crypto';
import { enTransaccion as transaccionReal } from '../config/db.js';
import * as documentoModelReal from '../models/documentoModel.js';
import * as viajeModelReal from '../models/viajeModel.js';
import * as almacenReal from './almacenService.js';
import * as ocrReal from './ocrService.js';
import { HttpError } from '../utils/httpError.js';

let enTransaccion = transaccionReal;
let documentoModel = documentoModelReal;
let viajeModel = viajeModelReal;
let almacen = almacenReal;
let ocr = ocrReal;

export function configurarDependenciasParaPruebas(dependencias) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Las dependencias solo se pueden sustituir en pruebas');
  ({ enTransaccion, documentoModel, viajeModel, almacen, ocr } = {
    enTransaccion: dependencias.enTransaccion || transaccionReal,
    documentoModel: dependencias.documentoModel || documentoModelReal,
    viajeModel: dependencias.viajeModel || viajeModelReal,
    almacen: dependencias.almacen || almacenReal,
    ocr: dependencias.ocr || ocrReal
  });
}

export const MAX_BYTES = 5 * 1024 * 1024; // límite de la API de visión por imagen
const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// El tipo real se averigua por los primeros bytes: la extensión o el Content-Type los manda el cliente y se pueden falsear
function detectarMime(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

const normalizar = (texto) => String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const TIPOS_COMPARABLES = new Set(['comprobante_entrega', 'guia_remision', 'factura']);

// ¿El documento menciona el folio del viaje? true / false, o null si no hay nada que comparar
function coincideConViaje(lectura, folio) {
  const objetivo = normalizar(folio);
  if (!objetivo || !lectura) return null;
  if (lectura.numero_guia && normalizar(lectura.numero_guia).includes(objetivo)) return true;
  if (normalizar(lectura.texto).includes(objetivo)) return true;
  return lectura.numero_guia || lectura.texto ? false : null;
}

// Lo que se guarda en la base a partir de lo que leyó el OCR
const camposDeLectura = (lectura, folio) => (lectura ? {
  tipo: lectura.tipo,
  numero_guia: TIPOS_COMPARABLES.has(lectura.tipo) ? lectura.numero_guia : null,
  coincide_viaje: TIPOS_COMPARABLES.has(lectura.tipo) ? coincideConViaje(lectura, folio) : null,
  texto_ocr: lectura.tipo === 'identificacion' ? null : lectura.texto,
  datos_json: lectura.tipo === 'identificacion' ? null : { fecha: lectura.fecha, receptor: lectura.receptor, monto: lectura.monto },
  confianza: lectura.confianza,
  calidad_ocr: lectura.calidad_ocr ?? null
} : {
  tipo: 'otro', numero_guia: null, coincide_viaje: null, texto_ocr: null,
  datos_json: null, confianza: null, calidad_ocr: null
});

// Nunca se muestra la clave interna del archivo ni el id del operador
const publico = ({ archivo_clave, operador_id, ...resto }) => resto;
const vistaOperador = (doc) => ({
  id: doc.id,
  viaje_id: doc.viaje_id,
  tipo: doc.tipo,
  numero_guia: doc.numero_guia,
  coincide_viaje: doc.coincide_viaje,
  creado_en: doc.creado_en,
  estado: doc.estado,
  nota_revision: doc.nota_revision
});

const idValido = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identificador no válido');
  return id;
};

// El operador solo ve y sube documentos de sus propios viajes
const verificarAcceso = (registro, usuario, mensaje) => {
  if (!registro) throw new HttpError(404, mensaje);
  if (usuario.rol === 'operador' && Number(registro.operador_id) !== Number(usuario.id)) {
    throw new HttpError(403, 'Ese viaje no está asignado a ti');
  }
};

const exigirAdmin = (usuario) => {
  if (usuario.rol !== 'admin') throw new HttpError(403, 'Solo un administrador puede realizar esta acción');
};

const exigirAdminOOperador = (usuario) => {
  if (!['admin', 'operador'].includes(usuario.rol)) {
    throw new HttpError(403, 'No tienes permiso para gestionar documentos');
  }
};

async function cargarDocumento(id, usuario) {
  const doc = await documentoModel.buscarPorId(idValido(id));
  verificarAcceso(doc, usuario, 'El documento no existe');
  return doc;
}

function validarPendiente(doc) {
  if (doc.archivado_en) throw new HttpError(409, 'El documento está archivado y no admite cambios.');
  if (doc.estado !== 'pendiente') throw new HttpError(409, 'El documento ya fue revisado y no se puede modificar');
  if (doc.ocr_estado === 'procesando') throw new HttpError(409, 'Espera a que termine el OCR antes de revisar el documento');
}

function validarRevisor(doc, usuario) {
  exigirAdmin(usuario);
  if (Number(doc.subido_por) === Number(usuario.id)) {
    throw new HttpError(403, 'No puedes revisar un documento que tú mismo subiste');
  }
  validarPendiente(doc);
}

// Lee el archivo y comprueba que no cambió desde que se subió (huella SHA-256)
async function leerVerificado(doc, usuario, dependencias = {}) {
  const almacenDocumento = dependencias.almacen || almacen;
  const modeloDocumento = dependencias.documentoModel || documentoModel;
  const buffer = await almacenDocumento.leer(doc.archivo_clave);
  if (sha256(buffer) !== doc.sha256) {
    await modeloDocumento.registrarBitacora(doc.id, usuario.id, 'alterado', 'La huella SHA-256 no coincide con la original');
    throw new HttpError(409, 'Integridad comprometida: el archivo no coincide con su huella digital. Avisa a un administrador.');
  }
  return buffer;
}

function programarOcr(doc, { buffer, usuarioId, accion } = {}) {
  const modeloDocumento = documentoModel;
  const transaccion = enTransaccion;
  const almacenDocumento = almacen;
  const motorOcr = ocr;
  setImmediate(async () => {
    try {
      const usuario = { id: usuarioId };
      const imagen = buffer || await leerVerificado(doc, usuario, { almacen: almacenDocumento, documentoModel: modeloDocumento });
      const lectura = await motorOcr.leerDocumento(imagen, doc.mime);
      await transaccion(async (c) => {
        await modeloDocumento.guardarLectura(doc.id, camposDeLectura(lectura, doc.folio), c);
      });
    } catch (error) {
      try {
        await modeloDocumento.registrarErrorOcr(doc.id, String(error.message || 'Error al leer el documento').slice(0, 255));
      } catch (errorEstado) {
        console.error(`No se pudo actualizar el estado OCR del documento ${doc.id}:`, errorEstado);
      }
      console.warn(`OCR no disponible para el documento ${doc.id}:`, error.message);
    }
  });
}

/* ---------- Subir ---------- */
export async function subir(archivo, { viaje_id: viajeId } = {}, usuario) {
  exigirAdminOOperador(usuario);
  const id = idValido(viajeId);
  if (!archivo?.buffer?.length) throw new HttpError(400, 'Adjunta la foto del comprobante');
  if (archivo.buffer.length > MAX_BYTES) throw new HttpError(413, 'La imagen pesa más de 5 MB');

  const viaje = await viajeModel.buscarPorId(id);
  verificarAcceso(viaje, usuario, 'El viaje no existe');
  if (viaje.estado === 'cancelado') throw new HttpError(409, 'El viaje está cancelado: ya no admite documentos');

  const mime = detectarMime(archivo.buffer);
  if (!mime) throw new HttpError(415, 'Solo se aceptan fotos JPG, PNG o WebP');

  const clave = `${crypto.randomUUID()}.${EXTENSION[mime]}`;
  let almacenado = false;
  let nuevoId;
  try {
    nuevoId = await enTransaccion(async (c) => {
      await documentoModel.bloquearViaje(id, c);
      if (await documentoModel.buscarDuplicado(id, sha256(archivo.buffer), c)) {
        throw new HttpError(409, 'Este viaje ya tiene un documento activo con la misma imagen.');
      }
      await almacen.guardar(clave, archivo.buffer, mime);
      almacenado = true;
      const creado = await documentoModel.crear({
        viaje_id: id,
        subido_por: usuario.id,
        ...camposDeLectura(null, viaje.folio),
        ocr_estado: 'procesando',
        archivo_clave: clave,
        mime,
        tamano: archivo.buffer.length,
        sha256: sha256(archivo.buffer)
      }, c);
      await documentoModel.registrarBitacora(creado, usuario.id, 'subido', null, c);
      return creado;
    });
  } catch (error) {
    if (almacenado) {
      try {
        await almacen.eliminar(clave); // no dejar archivos huérfanos si falló la base de datos
      } catch (errorAlmacen) {
        console.error(`No se pudo eliminar el archivo ${clave} después de fallar la base de datos:`, errorAlmacen);
      }
    }
    throw error;
  }

  const doc = await documentoModel.buscarPorId(nuevoId);
  programarOcr(doc, { buffer: archivo.buffer, usuarioId: usuario.id });
  return { ...publico(doc), aviso_ocr: 'El documento se guardó; la lectura OCR continúa en segundo plano.' };
}

/* ---------- Consultas ---------- */
export async function listar(consulta = {}, usuario) {
  exigirAdmin(usuario);
  const porPagina = Math.min(Math.max(Number(consulta.por_pagina) || 12, 4), 60);
  const pagina = Math.max(Number(consulta.pagina) || 1, 1);
  const resultado = await documentoModel.listar({
    estado: ESTADOS.includes(consulta.estado) ? consulta.estado : undefined,
    tipo: ocr.TIPOS.includes(consulta.tipo) ? consulta.tipo : undefined,
    viajeId: consulta.viaje_id ? idValido(consulta.viaje_id) : undefined,
    archivados: consulta.archivados === 'true',
    // % y _ son comodines en LIKE: se escapan para buscar el texto tal cual
    texto: consulta.q ? String(consulta.q).trim().slice(0, 80).replace(/[\\%_]/g, '\\$&') : undefined,
    limite: porPagina,
    desplazamiento: (pagina - 1) * porPagina
  });
  return {
    ...resultado,
    conteo: await documentoModel.conteoPorEstado(),
    pagina,
    por_pagina: porPagina,
    paginas: Math.max(Math.ceil(resultado.total / porPagina), 1)
  };
}

export async function porViaje(viajeId, usuario) {
  exigirAdminOOperador(usuario);
  const id = idValido(viajeId);
  const viaje = await viajeModel.buscarPorId(id);
  verificarAcceso(viaje, usuario, 'El viaje no existe');
  const documentos = await documentoModel.porViaje(id);
  return usuario.rol === 'admin' ? documentos : documentos.map(vistaOperador);
}

export async function detalle(id, usuario) {
  exigirAdmin(usuario);
  const doc = await cargarDocumento(id, usuario);
  return publico(doc.tipo === 'identificacion'
    ? { ...doc, texto_ocr: null, datos_json: null }
    : doc);
}

// Devuelve la imagen. `auditar` deja constancia en la bitácora de quién la abrió
export async function archivo(id, usuario, { auditar = true } = {}) {
  exigirAdmin(usuario);
  const doc = await cargarDocumento(id, usuario);
  const buffer = await leerVerificado(doc, usuario);
  if (auditar) {
    await enTransaccion(async (c) => {
      await documentoModel.bloquearDocumento(doc.id, c);
      if (!(await documentoModel.vistoEnUltimos(doc.id, usuario.id, 30, c))) {
        await documentoModel.registrarBitacora(doc.id, usuario.id, 'visto', null, c);
      }
    });
  }
  return { buffer, mime: doc.mime };
}

export async function bitacora(id, usuario) {
  exigirAdmin(usuario);
  const doc = await cargarDocumento(id, usuario);
  const registros = await documentoModel.bitacora(Number(id));
  if (doc.tipo !== 'identificacion') return registros;
  return registros.map((registro) => {
    if (!registro.nota || registro.accion !== 'corregido') return registro;
    try {
      const nota = JSON.parse(registro.nota);
      for (const seccion of [nota.anterior, nota.nuevo]) {
        if (seccion && Object.hasOwn(seccion, 'texto_ocr')) {
          seccion.texto_ocr = seccion.texto_ocr ? '[omitido por privacidad]' : '';
        }
      }
      return { ...registro, nota: JSON.stringify(nota) };
    } catch {
      return { ...registro, nota: '[omitida por privacidad]' };
    }
  });
}

/* ---------- Revisión ---------- */
export async function revisar(id, { estado, nota } = {}, usuario) {
  exigirAdmin(usuario);
  if (!['aprobado', 'rechazado'].includes(estado)) throw new HttpError(400, 'Elige aprobar o rechazar el documento');
  const texto = typeof nota === 'string' ? nota.trim().slice(0, 255) : '';
  if (estado === 'rechazado' && !texto) throw new HttpError(400, 'Explica el motivo del rechazo');
  let doc;
  await enTransaccion(async (c) => {
    doc = await documentoModel.buscarPorId(idValido(id), c, true);
    if (!doc) throw new HttpError(404, 'El documento no existe');
    validarRevisor(doc, usuario);
    if (estado === 'aprobado' && TIPOS_COMPARABLES.has(doc.tipo) && doc.coincide_viaje === false && !texto) {
      throw new HttpError(400, 'Justifica en una nota por qué apruebas un documento que no coincide con el viaje');
    }
    const actualizado = await documentoModel.revisar(doc.id, { estado, usuarioId: usuario.id, nota: texto || null }, c);
    if (!actualizado) throw new HttpError(409, 'El documento ya fue revisado y no se puede modificar');
    await documentoModel.registrarBitacora(doc.id, usuario.id, estado, texto || null, c);
  });
  return publico(await documentoModel.buscarPorId(doc.id));
}

const TIPOS_DOCUMENTO = ['comprobante_entrega', 'guia_remision', 'factura', 'identificacion', 'otro'];

function fechaValida(valor) {
  if (valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new HttpError(400, 'La fecha debe tener el formato AAAA-MM-DD');
  }
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    throw new HttpError(400, 'La fecha no es válida');
  }
  return valor;
}

function campoTexto(valor, anterior, maximo, nombre) {
  if (valor === undefined) return anterior;
  if (valor !== null && typeof valor !== 'string') throw new HttpError(400, `${nombre} debe ser texto`);
  return String(valor || '').trim().slice(0, maximo) || null;
}

function datosActuales(doc) {
  let datos = doc.datos_json;
  if (typeof datos === 'string') {
    try { datos = JSON.parse(datos); } catch { datos = {}; }
  }
  return {
    tipo: doc.tipo,
    numero_guia: doc.numero_guia || null,
    fecha: datos?.fecha || null,
    receptor: datos?.receptor || null,
    monto: datos?.monto === '' || datos?.monto === undefined ? null : datos?.monto,
    texto_ocr: doc.texto_ocr || ''
  };
}

function normalizarCorreccion(entrada, anterior) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new HttpError(400, 'Envía los datos que deseas corregir');
  }
  const textoOcr = entrada.texto_ocr === undefined ? anterior.texto_ocr
    : typeof entrada.texto_ocr === 'string' ? entrada.texto_ocr.trim().slice(0, 20000)
      : (() => { throw new HttpError(400, 'El texto OCR debe ser texto'); })();
  const nuevo = {
    tipo: entrada.tipo ?? anterior.tipo,
    numero_guia: campoTexto(entrada.numero_guia, anterior.numero_guia, 40, 'El número de guía')?.toUpperCase() || null,
    fecha: entrada.fecha === undefined ? anterior.fecha : fechaValida(entrada.fecha),
    receptor: campoTexto(entrada.receptor, anterior.receptor, 120, 'El receptor'),
    monto: entrada.monto === undefined ? anterior.monto : entrada.monto === '' || entrada.monto === null ? null
      : typeof entrada.monto === 'number' || typeof entrada.monto === 'string' ? Number(entrada.monto) : NaN,
    texto_ocr: textoOcr
  };
  if (!TIPOS_DOCUMENTO.includes(nuevo.tipo)) throw new HttpError(400, 'El tipo de documento no es válido');
  if (!TIPOS_COMPARABLES.has(nuevo.tipo)) {
    nuevo.numero_guia = null;
    nuevo.coincide_viaje = null;
  }
  if (nuevo.tipo === 'identificacion') {
    nuevo.texto_ocr = '';
    nuevo.fecha = null;
    nuevo.receptor = null;
    nuevo.monto = null;
  }
  if (nuevo.monto !== null && (!Number.isFinite(nuevo.monto) || nuevo.monto < 0 || nuevo.monto > 1_000_000_000)) {
    throw new HttpError(400, 'El monto debe estar entre 0 y 1,000,000,000');
  }
  if (JSON.stringify(nuevo) === JSON.stringify(anterior)) throw new HttpError(400, 'No hay cambios para guardar');
  return nuevo;
}

export async function corregir(id, entrada, usuario) {
  exigirAdmin(usuario);
  let resultado;
  await enTransaccion(async (c) => {
    const doc = await documentoModel.buscarPorId(idValido(id), c, true);
    if (!doc) throw new HttpError(404, 'El documento no existe');
    validarRevisor(doc, usuario);
    const anterior = datosActuales(doc);
    const nuevo = normalizarCorreccion(entrada, anterior);
    nuevo.coincide_viaje = TIPOS_COMPARABLES.has(nuevo.tipo)
      ? coincideConViaje({ numero_guia: nuevo.numero_guia, texto: nuevo.texto_ocr }, doc.folio)
      : null;
    const actualizado = await documentoModel.corregir(doc.id, nuevo, c);
    if (!actualizado) throw new HttpError(409, 'El documento ya fue revisado y no se puede modificar');
    const resumenSeguro = (datos) => ({
      ...datos,
      texto_ocr: datos.texto_ocr ? `[texto omitido; ${datos.texto_ocr.length} caracteres]` : ''
    });
    const nota = JSON.stringify({
      anterior: resumenSeguro(anterior),
      nuevo: resumenSeguro({ ...nuevo, coincide_viaje: nuevo.coincide_viaje })
    });
    await documentoModel.registrarBitacora(doc.id, usuario.id, 'corregido', nota, c);
    resultado = doc.id;
  });
  return publico(await documentoModel.buscarPorId(resultado));
}

// Vuelve a leer el documento con el OCR (por ejemplo, si falló o la lectura salió mal)
export async function reprocesar(id, usuario) {
  exigirAdmin(usuario);
  const buffer = await (async () => {
    const actual = await documentoModel.buscarPorId(idValido(id));
    if (!actual) throw new HttpError(404, 'El documento no existe');
    validarRevisor(actual, usuario);
    return leerVerificado(actual, usuario);
  })();
  let doc;
  await enTransaccion(async (c) => {
    doc = await documentoModel.buscarPorId(idValido(id), c, true);
    if (!doc) throw new HttpError(404, 'El documento no existe');
    validarRevisor(doc, usuario);
    if (doc.ocr_estado === 'procesando') throw new HttpError(409, 'El OCR de este documento ya está en proceso');
    await documentoModel.actualizarEstadoOcr(doc.id, 'procesando', c);
    await documentoModel.registrarBitacora(doc.id, usuario.id, 'reprocesado', null, c);
  });
  programarOcr(doc, { buffer, usuarioId: usuario.id });
  return publico(await documentoModel.buscarPorId(doc.id));
}

export async function archivar(id, { motivo } = {}, usuario) {
  exigirAdmin(usuario);
  const razon = typeof motivo === 'string' ? motivo.trim().slice(0, 255) : '';
  if (!razon) throw new HttpError(400, 'Escribe el motivo obligatorio para archivar.');
  let documentoId;
  await enTransaccion(async (c) => {
    const inicial = await documentoModel.buscarPorId(idValido(id), c);
    if (!inicial) throw new HttpError(404, 'El documento no existe');
    await documentoModel.bloquearViaje(inicial.viaje_id, c);
    const actual = await documentoModel.buscarPorId(idValido(id), c, true);
    if (!actual) throw new HttpError(404, 'El documento no existe');
    if (actual.archivado_en) throw new HttpError(409, 'El documento ya está archivado.');
    if (!['pendiente', 'rechazado'].includes(actual.estado)) {
      throw new HttpError(409, 'Solo se pueden archivar documentos pendientes o rechazados; los aprobados se conservan.');
    }
    const actualizado = await documentoModel.archivar(actual.id, usuario.id, razon, c);
    if (!actualizado) throw new HttpError(409, 'El documento cambió mientras se archivaba.');
    await documentoModel.registrarBitacora(actual.id, usuario.id, 'archivado', razon, c);
    documentoId = actual.id;
  });
  return publico(await documentoModel.buscarPorId(documentoId));
}

export async function restaurar(id, usuario) {
  exigirAdmin(usuario);
  let documentoId;
  await enTransaccion(async (c) => {
    const inicial = await documentoModel.buscarPorId(idValido(id), c);
    if (!inicial) throw new HttpError(404, 'El documento no existe');
    await documentoModel.bloquearViaje(inicial.viaje_id, c);
    const actual = await documentoModel.buscarPorId(idValido(id), c, true);
    if (!actual) throw new HttpError(404, 'El documento no existe');
    if (!actual.archivado_en) throw new HttpError(409, 'El documento no está archivado.');
    if (!['pendiente', 'rechazado'].includes(actual.estado)) {
      throw new HttpError(409, 'Los documentos aprobados no pueden archivarse ni restaurarse.');
    }
    const actualizado = await documentoModel.restaurar(actual.id, c);
    if (!actualizado) throw new HttpError(409, 'El documento cambió mientras se restauraba.');
    await documentoModel.registrarBitacora(actual.id, usuario.id, 'restaurado', null, c);
    documentoId = actual.id;
  });
  return publico(await documentoModel.buscarPorId(documentoId));
}

export async function lote({ accion, ids, motivo } = {}, usuario) {
  exigirAdmin(usuario);
  if (!['archivar', 'reintentar_ocr'].includes(accion)) throw new HttpError(400, 'La acción por lote no es válida.');
  if (!Array.isArray(ids) || !ids.length || ids.length > 20) {
    throw new HttpError(400, 'Selecciona entre 1 y 20 documentos.');
  }
  if (new Set(ids.map(Number)).size !== ids.length) throw new HttpError(400, 'La selección contiene documentos repetidos.');
  if (accion === 'archivar' && !(typeof motivo === 'string' && motivo.trim())) {
    throw new HttpError(400, 'Escribe el motivo obligatorio para archivar.');
  }

  const resultados = [];
  for (const id of ids) {
    try {
      if (accion === 'archivar') await archivar(id, { motivo }, usuario);
      else await reprocesar(id, usuario);
      resultados.push({ id, ok: true, message: accion === 'archivar' ? 'Archivado' : 'Lectura en cola' });
    } catch (error) {
      resultados.push({ id, ok: false, message: error.message });
    }
  }
  return { resultados };
}

export async function recuperarLecturasOcr() {
  if (await documentoModel.asegurarEstadoOcr()) {
    console.log('✔ Columna agregada automáticamente: documentos.ocr_estado');
  }
  const pendientes = await documentoModel.pendientesOcr();
  pendientes.forEach((doc) => programarOcr(doc, { usuarioId: doc.subido_por }));
  return pendientes.length;
}