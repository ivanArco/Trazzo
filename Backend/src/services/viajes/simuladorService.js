// Seguimiento SIMULADO (solo de prueba): mientras no haya GPS real, cada cierto tiempo
// calcula el avance entre la salida programada y la ETA prevista.
import { enTransaccion } from '../../config/db.js';
import * as viajeModel from '../../models/viajeModel.js';
import * as flotaModel from '../../models/flotaModel.js';
import { avisarViaje, CERCA_DEL_DESTINO } from '../notificacionService.js';

const MILISEGUNDOS_POR_MINUTO = 60_000;
// Es una simulación: con 60, cada hora de viaje tarda 1 minuto. Con 1 tarda el tiempo real.
const VELOCIDAD = Number(process.env.SIMULADOR_VELOCIDAD) || 60;
const MINUTOS_POR_PUNTO = 3;

export function calcularProgresoProgramado(viaje, ahora = Date.now(), velocidad = VELOCIDAD) {
  const salida = Number(viaje.salida_ms);
  if (!Number.isFinite(salida)) return null;
  if (viaje.estado === 'asignado' && ahora < salida) return null;

  const duracion = Number(viaje.duracion_min);
  const duracionMinutos = Number.isFinite(duracion) && duracion > 0
    ? duracion
    : 100 * MINUTOS_POR_PUNTO;
  const etaGuardada = Number(viaje.eta_ms);
  const inicioReal = Number(viaje.inicio_ms);
  const duracionMs = duracionMinutos * MILISEGUNDOS_POR_MINUTO / velocidad;

  // Si se inició a mano antes de su salida programada, el tiempo corre desde ese momento
  const adelantado = viaje.estado !== 'asignado' && Number.isFinite(inicioReal) && inicioReal < salida;
  const inicio = adelantado ? inicioReal : salida;
  const etaPrevista = inicio + duracionMs;
  const etaValida = Number.isFinite(etaGuardada) && etaGuardada > inicio;
  const eta = !etaValida ? etaPrevista
    : adelantado || velocidad > 1 ? Math.min(etaGuardada, etaPrevista) : etaGuardada;
  const porcentajeTiempo = Math.max(0, Math.min(1, (ahora - inicio) / (eta - inicio)));
  const avanceCalculado = Math.floor(porcentajeTiempo * 100);
  const avance = Math.max(Number(viaje.avance) || 0, avanceCalculado);
  const entregado = ahora >= eta;

  return {
    estado: entregado ? 'entregado' : 'en_ruta',
    avance: entregado ? 100 : Math.min(avance, 99),
    eta,
    iniciar: viaje.estado === 'asignado',
    entregado
  };
}

async function moverViaje(viaje, ahora = Date.now()) {
  if (viaje.gps_reciente) return;
  const progreso = calcularProgresoProgramado(viaje, ahora);
  if (!progreso) return;

  const etaSql = `FROM_UNIXTIME(${Math.floor(progreso.eta / 1000)})`;
  const campos = progreso.entregado
    ? {
        estado: 'entregado',
        avance: 100,
        eta: { sql: etaSql },
        entregado_en: { sql: etaSql }
      }
    : {
        estado: progreso.estado,
        avance: progreso.avance,
        eta: { sql: etaSql }
      };
  const eventos = [];
  if (progreso.iniciar) {
    eventos.push(['en_ruta', `Viaje iniciado automáticamente según su hora de salida (simulación)`]);
  }
  if (progreso.avance >= 50 && viaje.avance < 50 && !progreso.entregado) {
    eventos.push(['avance', 'Va a la mitad del recorrido (simulación por horario)']);
  }
  if (progreso.entregado) {
    eventos.push(['entregado', 'Llegó a destino según su hora de salida y ETA (simulación)']);
  }

  await enTransaccion(async (conexion) => {
    await viajeModel.actualizar(viaje.id, campos, conexion);
    if (progreso.entregado && viaje.unidad_id) {
      await flotaModel.cambiarEstadoUnidad(viaje.unidad_id, 'disponible', conexion);
    }
    if (progreso.entregado) await viajeModel.borrarUbicacion(viaje.id, conexion);
    for (const [tipo, descripcion] of eventos) {
      await viajeModel.registrarEvento(viaje.id, tipo, descripcion, null, conexion);
    }
  });

  // Notificaciones: cambios de estado y el momento en que cruza el 90 % del recorrido
  if (progreso.entregado) {
    avisarViaje(viaje.id, 'entregado');
  } else if (progreso.iniciar) {
    avisarViaje(viaje.id, 'en_ruta');
  } else if (viaje.avance < CERCA_DEL_DESTINO && progreso.avance >= CERCA_DEL_DESTINO) {
    avisarViaje(viaje.id, 'cerca');
  }
}

export function iniciarSimulador(segundos) {
  if (!segundos) return;
  let ocupado = false;

  setInterval(async () => {
    if (ocupado) return; // si la base tarda, no se enciman las vueltas
    ocupado = true;
    try {
      for (const viaje of await viajeModel.viajesEnMovimiento()) await moverViaje(viaje);
    } catch (error) {
      console.error('Simulador:', error.message);
    } finally {
      ocupado = false;
    }
  }, segundos * 1000);

  console.log(`Simulador de seguimiento activo: progreso por hora de salida y ETA cada ${segundos} s`);
}
