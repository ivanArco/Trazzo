import { enTransaccion } from '../config/db.js';
import * as viajeModel from '../models/viajeModel.js';
import * as flotaModel from '../models/flotaModel.js';
import { HttpError } from '../utils/httpError.js';
import { calcularDuracionCamion, estimar, progresoEnRuta } from './rutaService.js';

export const ESTADOS = ['pendiente', 'asignado', 'en_ruta', 'retraso', 'entregado', 'cancelado'];
const rutasDelMapa = new Map();

// A qué estados puede pasar un viaje desde cada estado
export const TRANSICIONES = {
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

export const mapa = async (usuario) => {
  const viajes = await viajeModel.viajesParaMapa(usuario.rol === 'operador' ? usuario.id : undefined);
  const activos = new Set(viajes.map((viaje) => viaje.id));
  for (const id of rutasDelMapa.keys()) {
    if (!activos.has(id)) rutasDelMapa.delete(id);
  }

  return await Promise.all(viajes.map(async (viaje) => {
    const firma = [
      viaje.origen, viaje.destino, viaje.gps_origen || '', viaje.gps_destino || '',
      process.env.VELOCIDAD_PROMEDIO_CAMION_KMH || '65',
      process.env.FACTOR_RESTRICCION_RUTA || '1'
    ].join('|');
    let entrada = rutasDelMapa.get(viaje.id);
    if (!entrada || entrada.firma !== firma || (entrada.error && entrada.reintentarEn <= Date.now())) {
      entrada = { firma, reintentarEn: 0 };
      entrada.promesa = estimar(viaje)
        .then((ruta) => { entrada.ruta = ruta; return ruta; })
        .catch((error) => {
          entrada.error = error.message;
          entrada.reintentarEn = Date.now() + 60_000;
          return null;
        });
      rutasDelMapa.set(viaje.id, entrada);
    }

    const ruta = entrada.ruta || await entrada.promesa;
    const distancia = ruta?.distancia_km ?? viaje.distancia_km;
    const tieneDistancia = distancia !== null && distancia !== undefined
      && distancia !== '' && Number.isFinite(Number(distancia));
    const puntoGps = viaje.gps_reciente && Number.isFinite(Number(viaje.gps_latitud))
      && Number.isFinite(Number(viaje.gps_longitud))
      ? [Number(viaje.gps_latitud), Number(viaje.gps_longitud)]
      : null;
    const progresoGps = puntoGps && ruta?.trazo ? progresoEnRuta(ruta.trazo, puntoGps) : null;
    const restanteKm = progresoGps?.restante_km
      ?? (tieneDistancia ? Number(distancia) * Math.max(0, 100 - viaje.avance) / 100 : null);
    const estimacion = Number.isFinite(restanteKm)
      ? calcularDuracionCamion(restanteKm)
      : { duracion_min: viaje.duracion_min, velocidad_promedio_kmh: null, factor_restriccion: null };
    const etaProyectada = ['en_ruta', 'retraso'].includes(viaje.estado) && Number.isFinite(estimacion.duracion_min)
      ? new Date(Date.now()
        + estimacion.duracion_min * 60_000
        + (viaje.estado === 'retraso' ? 20 * 60_000 : 0)).toISOString()
      : viaje.eta;
    return {
      ...viaje,
      trazo: ruta?.trazo || null,
      gps_latitud: puntoGps?.[0] ?? null,
      gps_longitud: puntoGps?.[1] ?? null,
      avance_mapa: progresoGps?.avance ?? viaje.avance,
      gps_reciente: Boolean(puntoGps),
      distancia_ruta_km: distancia,
      duracion_ruta_min: ruta?.duracion_min ?? viaje.duracion_min,
      eta_restante_min: estimacion.duracion_min,
      eta_proyectada: etaProyectada,
      velocidad_promedio_kmh: estimacion.velocidad_promedio_kmh,
      factor_restriccion: estimacion.factor_restriccion,
      ruta_error: ruta ? null : entrada.error
    };
  }));
};

export const actualizarUbicacion = async (id, datos = {}, usuario) => {
  const viaje = await viajeModel.buscarPorId(id);
  verificarAcceso(viaje, usuario);
  if (usuario.rol !== 'operador') throw new HttpError(403, 'Solo el operador asignado puede compartir su ubicación');
  if (!['en_ruta', 'retraso'].includes(viaje.estado)) {
    throw new HttpError(409, 'El GPS del teléfono solo se puede compartir durante un viaje en curso');
  }

  const latitud = datos.latitud;
  const longitud = datos.longitud;
  const precision = datos.precision_m;
  if (typeof latitud !== 'number' || !Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
    throw new HttpError(400, 'La latitud GPS no es válida');
  }
  if (typeof longitud !== 'number' || !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    throw new HttpError(400, 'La longitud GPS no es válida');
  }
  if (typeof precision !== 'number' || !Number.isFinite(precision) || precision < 0 || precision > 100_000) {
    throw new HttpError(400, 'La precisión GPS no es válida');
  }

  await viajeModel.guardarUbicacion(id, { latitud, longitud, precision_m: precision });
  return await viajeModel.buscarPorId(id);
};

export const detenerUbicacion = async (id, usuario) => {
  const viaje = await viajeModel.buscarPorId(id);
  verificarAcceso(viaje, usuario);
  if (usuario.rol !== 'operador') throw new HttpError(403, 'Solo el operador asignado puede detener su ubicación');
  await viajeModel.borrarUbicacion(id);
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Filtros del historial → parámetros seguros para la consulta
function filtrosHistorial({ estado, q, desde, hasta } = {}, usuario) {
  if (desde && !FECHA.test(desde)) throw new HttpError(400, 'La fecha "desde" no es válida');
  if (hasta && !FECHA.test(hasta)) throw new HttpError(400, 'La fecha "hasta" no es válida');
  if (desde && hasta && desde > hasta) throw new HttpError(400, 'La fecha "desde" debe ser anterior a "hasta"');
  return {
    estados: estado ? String(estado).split(',').filter((e) => ESTADOS.includes(e)) : undefined,
    // % y _ son comodines en LIKE: se escapan para buscar el texto tal cual
    texto: q ? String(q).trim().slice(0, 80).replace(/[\\%_]/g, '\\$&') : undefined,
    desde,
    hasta,
    operadorId: usuario.rol === 'operador' ? usuario.id : undefined
  };
}

export const historial = async (consulta = {}, usuario) => {
  const porPagina = Math.min(Math.max(Number(consulta.por_pagina) || 20, 5), 100);
  const pagina = Math.max(Number(consulta.pagina) || 1, 1);
  const resultado = await viajeModel.historial({
    ...filtrosHistorial(consulta, usuario),
    limite: porPagina,
    desplazamiento: (pagina - 1) * porPagina
  });
  return {
    ...resultado,
    pagina,
    por_pagina: porPagina,
    paginas: Math.max(Math.ceil(resultado.total / porPagina), 1)
  };
};

// Mismo filtro que el historial, en CSV para abrir en Excel (máximo 5,000 viajes)
export const historialCsv = async (consulta = {}, usuario) => {
  const { viajes } = await viajeModel.historial({ ...filtrosHistorial(consulta, usuario), limite: 5000, desplazamiento: 0 });
  const fecha = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const celda = (valor) => {
    const texto = String(valor ?? '');
    return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const columnas = [
    ['Folio', (v) => v.folio], ['Estado', (v) => v.estado], ['Salida', (v) => fecha(v.salida)],
    ['Entregado', (v) => fecha(v.entregado_en)], ['Origen', (v) => v.origen], ['Destino', (v) => v.destino],
    ['Cliente', (v) => v.cliente], ['Mercancía', (v) => v.mercancia], ['Peso (kg)', (v) => v.peso_kg],
    ['Flete (MXN)', (v) => v.flete], ['Distancia (km)', (v) => v.distancia_km], ['Operador', (v) => v.operador],
    ['Unidad', (v) => v.placas]
  ];
  const lineas = [
    columnas.map(([titulo]) => celda(titulo)).join(','),
    ...viajes.map((v) => columnas.map(([, valor]) => celda(valor(v))).join(','))
  ];
  return '﻿' + lineas.join('\r\n'); // BOM: Excel reconoce los acentos
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
    if (['entregado', 'cancelado'].includes(estado)) {
      await viajeModel.borrarUbicacion(viaje.id, conexion);
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
