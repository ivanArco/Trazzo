import { enTransaccion } from '../config/db.js';
import * as viajeModel from '../models/viajeModel.js';
import * as flotaModel from '../models/flotaModel.js';
import { HttpError } from '../utils/httpError.js';
import { estimar } from './rutaService.js';

export const ESTADOS = ['pendiente', 'asignado', 'en_ruta', 'retraso', 'entregado', 'cancelado'];

// A qué estados puede pasar un viaje desde cada estado
const TRANSICIONES = {
  pendiente: ['cancelado'],            // de pendiente a asignado se pasa con asignar()
  asignado: ['en_ruta', 'cancelado'],
  en_ruta: ['retraso', 'entregado', 'cancelado'],
  retraso: ['en_ruta', 'entregado', 'cancelado'],
  entregado: [],
  cancelado: []
};

const MINUTOS_POR_PUNTO = 3; // si no se pudo calcular la ruta: cada 1 % de avance ≈ 3 minutos

const esUrl = (texto) => /^https?:\/\/\S+$/i.test(texto);

const numero = (valor) => (valor === '' || valor === null || valor === undefined ? NaN : Number(valor));

// El operador solo puede ver y mover sus propios viajes
const verificarAcceso = (viaje, usuario) => {
  if (!viaje) throw new HttpError(404, 'El viaje no existe');
  if (usuario.rol === 'operador' && viaje.operador_id !== usuario.id) {
    throw new HttpError(403, 'Ese viaje no está asignado a ti');
  }
};

export const listar = async ({ estado } = {}, usuario) => {
  const estados = estado ? String(estado).split(',').filter((e) => ESTADOS.includes(e)) : undefined;
  return await viajeModel.listar({
    estados,
    operadorId: usuario.rol === 'operador' ? usuario.id : undefined
  });
};

export const detalle = async (id, usuario) => {
  const viaje = await viajeModel.buscarPorId(id);
  verificarAcceso(viaje, usuario);
  return { ...viaje, eventos: await viajeModel.eventosDeViaje(id) };
};

export const resumen = async () => viajeModel.resumen();

export const eventosRecientes = async (usuario) => viajeModel.eventosRecientes({
  operadorId: usuario.rol === 'operador' ? usuario.id : undefined
});

export const crear = async (datos = {}, usuario) => {
  const viaje = {
    origen: datos.origen?.trim(),
    destino: datos.destino?.trim(),
    gps_origen: datos.gps_origen?.trim() || null,
    gps_destino: datos.gps_destino?.trim() || null,
    mercancia: datos.mercancia?.trim(),
    peso_kg: numero(datos.peso_kg),
    num_unidades: numero(datos.num_unidades ?? 1),
    flete: numero(datos.flete ?? 0),
    cliente: datos.cliente?.trim(),
    salida: new Date(datos.salida),
    creado_por: usuario.id
  };

  if (!viaje.origen || !viaje.destino || !viaje.mercancia || !viaje.cliente || !datos.salida) {
    throw new HttpError(400, 'Origen, destino, mercancía, cliente y salida son obligatorios');
  }
  if (!(viaje.peso_kg > 0)) throw new HttpError(400, 'El peso debe ser mayor a 0 kg');
  if (!Number.isInteger(viaje.num_unidades) || viaje.num_unidades < 1) throw new HttpError(400, 'El número de unidades debe ser 1 o más');
  if (!(viaje.flete >= 0)) throw new HttpError(400, 'El flete no puede ser negativo');
  if (Number.isNaN(viaje.salida.getTime())) throw new HttpError(400, 'La fecha de salida no es válida');
  for (const campo of ['gps_origen', 'gps_destino']) {
    if (viaje[campo] && !esUrl(viaje[campo])) throw new HttpError(400, 'Los enlaces GPS deben empezar con https://');
  }

  // Distancia y tiempo reales por carretera; si el servicio de mapas falla, el viaje se guarda igual
  try {
    const ruta = await estimar(viaje);
    viaje.distancia_km = ruta.distancia_km;
    viaje.duracion_min = ruta.duracion_min;
  } catch {
    viaje.distancia_km = null;
    viaje.duracion_min = null;
  }

  const id = await enTransaccion(async (conexion) => {
    const nuevoId = await viajeModel.crear(viaje, conexion);
    await viajeModel.registrarEvento(nuevoId, 'creado', `Registrado por ${usuario.nombre}`, usuario.id, conexion);
    return nuevoId;
  });
  return await viajeModel.buscarPorId(id);
};

export const asignar = async (id, { operador_id, unidad_id } = {}, usuario) => {
  if (!operador_id || !unidad_id) throw new HttpError(400, 'Elige un operador y una unidad');

  await enTransaccion(async (conexion) => {
    const viaje = await viajeModel.buscarPorId(id, conexion);
    if (!viaje) throw new HttpError(404, 'El viaje no existe');
    if (!['pendiente', 'asignado'].includes(viaje.estado)) {
      throw new HttpError(409, 'Solo se pueden asignar viajes pendientes o que aún no salen');
    }

    const operador = await flotaModel.buscarOperador(operador_id, conexion);
    if (!operador) throw new HttpError(400, 'El operador no existe');
    const ocupado = await viajeModel.viajeActivoDeOperador(operador.id, viaje.id, conexion);
    if (ocupado) throw new HttpError(409, `${operador.nombre} ya tiene el viaje ${ocupado.folio}`);

    const unidad = await flotaModel.unidadParaAsignar(unidad_id, conexion);
    if (!unidad) throw new HttpError(400, 'La unidad no existe');
    if (unidad.estado !== 'disponible' && unidad.id !== viaje.unidad_id) {
      throw new HttpError(409, `La unidad ${unidad.placas} no está disponible`);
    }
    if (viaje.peso_kg > unidad.capacidad_kg) {
      throw new HttpError(400, `La unidad ${unidad.placas} soporta hasta ${unidad.capacidad_kg.toLocaleString('es-MX')} kg`);
    }

    // Si se cambia de unidad, la anterior queda libre
    if (viaje.unidad_id && viaje.unidad_id !== unidad.id) {
      await flotaModel.cambiarEstadoUnidad(viaje.unidad_id, 'disponible', conexion);
    }
    await flotaModel.cambiarEstadoUnidad(unidad.id, 'en_ruta', conexion);
    await viajeModel.actualizar(viaje.id, { operador_id: operador.id, unidad_id: unidad.id, estado: 'asignado' }, conexion);
    await viajeModel.registrarEvento(
      viaje.id, 'asignado', `Asignado a ${operador.nombre} con la unidad ${unidad.placas}`, usuario.id, conexion
    );
  });

  return await viajeModel.buscarPorId(id);
};

const DESCRIPCION = {
  en_ruta: (viaje, usuario) => (viaje.estado === 'retraso' ? 'Recorrido normalizado' : `Viaje iniciado por ${usuario.nombre}`),
  retraso: () => 'Retraso reportado',
  entregado: () => 'Entrega confirmada',
  cancelado: () => 'Viaje cancelado'
};

export const cambiarEstado = async (id, { estado, nota } = {}, usuario) => {
  const viaje = await viajeModel.buscarPorId(id);
  verificarAcceso(viaje, usuario);

  if (!TRANSICIONES[viaje.estado]?.includes(estado)) {
    throw new HttpError(409, `No se puede pasar de "${viaje.estado}" a "${estado}"`);
  }
  if (estado === 'cancelado' && !['admin', 'capturista'].includes(usuario.rol)) {
    throw new HttpError(403, 'Solo la oficina puede cancelar un viaje');
  }

  await enTransaccion(async (conexion) => {
    await viajeModel.actualizar(viaje.id, camposPorEstado(viaje, estado), conexion);
    if (['entregado', 'cancelado'].includes(estado) && viaje.unidad_id) {
      await flotaModel.cambiarEstadoUnidad(viaje.unidad_id, 'disponible', conexion);
    }
    const texto = DESCRIPCION[estado](viaje, usuario) + (nota?.trim() ? `: ${nota.trim().slice(0, 150)}` : '');
    await viajeModel.registrarEvento(viaje.id, estado, texto, usuario.id, conexion);
  });

  return await viajeModel.buscarPorId(id);
};

// Columnas que cambian junto con el estado (avance, hora estimada de llegada, entrega)
export const camposPorEstado = (viaje, estado, avance = viaje.avance) => {
  const minutosPorPunto = viaje.duracion_min ? viaje.duracion_min / 100 : MINUTOS_POR_PUNTO;
  const restante = Math.round(Math.max(0, 100 - avance) * minutosPorPunto);
  switch (estado) {
    case 'en_ruta':
      return { estado, avance: Math.max(avance, 1), eta: { sql: `NOW() + INTERVAL ${restante} MINUTE` } };
    case 'retraso':
      return { estado, avance, eta: { sql: `NOW() + INTERVAL ${restante + 20} MINUTE` } };
    case 'entregado':
      return { estado, avance: 100, eta: { sql: 'NOW()' }, entregado_en: { sql: 'NOW()' } };
    default:
      return { estado };
  }
};
