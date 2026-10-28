// Botón de pánico: el operador lo activa desde la app móvil en caso de robo de la unidad u otra
// emergencia. La alerta queda ligada a su viaje y unidad, guarda la ubicación GPS y los
// administradores la ven en la web hasta que la marcan como atendida o como falsa alarma.
// El operador no puede cancelarla: si lo obligan a hacerlo, la alerta debe seguir activa.
import { enTransaccion } from '../config/db.js';
import * as panicoModel from '../models/panicoModel.js';
import * as viajeModel from '../models/viajeModel.js';
import { HttpError } from '../utils/httpError.js';
import { enviarARoles } from './pushService.js';

const RESOLUCIONES = { atendida: 'atendida', falsa_alarma: 'falsa alarma' };

function numeroEnRango(valor, minimo, maximo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < minimo || n > maximo) throw new HttpError(400, 'La ubicación no es válida');
  return n;
}

// { lat, lon, precision_m } → valores validados; sin GPS, lat y lon quedan en null
function leerUbicacion(datos = {}) {
  const lat = numeroEnRango(datos.lat, -90, 90);
  const lon = numeroEnRango(datos.lon, -180, 180);
  if ((lat === null) !== (lon === null)) throw new HttpError(400, 'Envía la latitud y la longitud juntas');
  const precision = numeroEnRango(datos.precision_m, 0, 100000);
  return { lat, lon, precision_m: precision === null ? null : Math.round(precision) };
}

const texto = (valor, maximo = 255) => (valor == null ? null : String(valor).trim().slice(0, maximo) || null);

// Activa la alerta del operador. Si ya tiene una activa (la app reintentó o volvió la señal),
// no se crea otra: se devuelve la misma y se guarda la ubicación nueva.
export async function activar(datos = {}, usuario) {
  const ubicacion = leerUbicacion(datos);
  const nota = texto(datos.nota);

  const resultado = await enTransaccion(async (conexion) => {
    await panicoModel.bloquearOperador(usuario.id, conexion);

    const existente = await panicoModel.activaDeOperador(usuario.id, conexion);
    if (existente) {
      if (ubicacion.lat !== null) await panicoModel.agregarUbicacion(existente.id, ubicacion, conexion);
      return { alerta: await panicoModel.buscarPorId(existente.id, conexion), nueva: false };
    }

    const viaje = await panicoModel.viajeActivoDeOperador(usuario.id, conexion);
    const id = await panicoModel.crear({
      operador_id: usuario.id, viaje_id: viaje?.id ?? null, unidad_id: viaje?.unidad_id ?? null, nota
    }, conexion);
    if (ubicacion.lat !== null) await panicoModel.agregarUbicacion(id, ubicacion, conexion);
    if (viaje) {
      await viajeModel.registrarEvento(viaje.id, 'panico', `Botón de pánico activado por ${usuario.nombre}`, usuario.id, conexion);
    }
    return { alerta: await panicoModel.buscarPorId(id, conexion), nueva: true };
  });

  // Notificación push a los administradores (aunque tengan la app cerrada). Se envía después de
  // guardar la alerta y sin esperarla: si el servicio push falla, la alerta ya quedó registrada.
  if (resultado.nueva) notificarAdmins(resultado.alerta);
  return resultado;
}

function notificarAdmins(alerta) {
  const detalle = [alerta.folio, alerta.placas, alerta.nota].filter(Boolean).join(' · ');
  enviarARoles(['admin'], {
    titulo: `🚨 Botón de pánico: ${alerta.operador}`,
    cuerpo: detalle || 'Sin viaje activo',
    url: './#tablero',
    etiqueta: `panico-${alerta.id}`,
    urgente: true,
    urgencia: 'high',
    ttl: 24 * 60 * 60
  }).catch((error) => console.error('Push de pánico no enviada:', error.message));
}

// La app manda la ubicación cada ~30 s mientras la alerta siga activa
export async function registrarUbicacion(id, datos = {}, usuario) {
  const ubicacion = leerUbicacion(datos);
  if (ubicacion.lat === null) throw new HttpError(400, 'Envía la latitud y la longitud');

  const alerta = await panicoModel.buscarPorId(id);
  if (!alerta || alerta.operador_id !== usuario.id) throw new HttpError(404, 'La alerta no existe');
  if (alerta.estado !== 'activa') throw new HttpError(409, 'La alerta ya fue cerrada por un administrador');

  await panicoModel.agregarUbicacion(id, ubicacion);
  return panicoModel.buscarPorId(id);
}

// Para que la app sepa, al abrirse, si el operador tiene una alerta en curso
export const activaDelOperador = async (usuario) => (await panicoModel.activaDeOperador(usuario.id)) || null;

const ESTADOS = ['activa', 'atendida', 'falsa_alarma'];

export async function listar({ estado } = {}) {
  const estados = String(estado || '').split(',').map((e) => e.trim()).filter(Boolean);
  if (estados.some((e) => !ESTADOS.includes(e))) throw new HttpError(400, `Estado no válido. Usa: ${ESTADOS.join(', ')}`);
  return panicoModel.listar({ estados });
}

export async function detalle(id) {
  const alerta = await panicoModel.buscarPorId(id);
  if (!alerta) throw new HttpError(404, 'La alerta no existe');
  return { ...alerta, ubicaciones: await panicoModel.ubicaciones(id) };
}

export async function resolver(id, datos = {}, usuario) {
  const estado = datos.estado;
  if (!RESOLUCIONES[estado]) throw new HttpError(400, 'El estado debe ser "atendida" o "falsa_alarma"');
  const resolucion = texto(datos.resolucion);

  return enTransaccion(async (conexion) => {
    const alerta = await panicoModel.buscarPorId(id, conexion);
    if (!alerta) throw new HttpError(404, 'La alerta no existe');
    if (alerta.estado !== 'activa') throw new HttpError(409, 'La alerta ya estaba cerrada');

    await panicoModel.resolver(id, { estado, atendida_por: usuario.id, resolucion }, conexion);
    if (alerta.viaje_id) {
      const detalleTexto = `Alerta de pánico marcada como ${RESOLUCIONES[estado]} por ${usuario.nombre}${resolucion ? `: ${resolucion}` : ''}`;
      await viajeModel.registrarEvento(alerta.viaje_id, 'panico', detalleTexto.slice(0, 255), usuario.id, conexion);
    }
    return panicoModel.buscarPorId(id, conexion);
  });
}
