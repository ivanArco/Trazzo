// Seguimiento SIMULADO (solo de prueba): el viaje avanza de su inicio a su hora estimada de llegada (ETA).
// Se inicia solo a su hora de salida, o antes si alguien lo inicia a mano. Algunos pasan por una situación que
// los retrasa un momento. Si el operador comparte el GPS de su teléfono, el viaje queda fuera de la simulación.
import { enTransaccion } from '../../config/db.js';
import * as viajeModel from '../../models/viajeModel.js';
import * as flotaModel from '../../models/flotaModel.js';
import { avisarViaje, CERCA_DEL_DESTINO } from '../notificacionService.js';

const MINUTOS_SIN_RUTA = 300; // duración de un viaje cuya ruta no se pudo calcular
// 1 = tiempo real. Con 60, cada hora de viaje tarda 1 minuto (útil para una demostración).
const VELOCIDAD = Number(process.env.SIMULADOR_VELOCIDAD) || 1;

// Cada viaje siempre tiene la misma situación, según su id. desde y hasta son fracciones del tiempo del viaje.
const SITUACIONES = [
  null,
  { desde: 0.25, hasta: 0.5, texto: 'Tráfico intenso en la carretera' },
  { desde: 0.35, hasta: 0.6, texto: 'Lluvia fuerte en la ruta' },
  null,
  { desde: 0.45, hasta: 0.75, texto: 'Falla mecánica, atendida en el camino' },
  { desde: 0.6, hasta: 0.75, texto: 'Revisión en un punto de control' },
  { desde: 0.8, hasta: 0.95, texto: 'El cliente no estaba listo para recibir' }
];

export const situacionDe = (id) => SITUACIONES[Number(id) % SITUACIONES.length];

// Fracción del recorrido según el tiempo: se detiene durante la situación y después recupera lo perdido
function fraccionRecorrida(tiempo, situacion) {
  if (!situacion || tiempo <= situacion.desde) return tiempo;
  if (tiempo < situacion.hasta) return situacion.desde;
  return situacion.desde + (tiempo - situacion.hasta) * (1 - situacion.desde) / (1 - situacion.hasta);
}

export function calcularProgreso(viaje, ahora = Date.now(), velocidad = VELOCIDAD) {
  const salida = Number(viaje.salida_ms);
  if (!Number.isFinite(salida)) return null;
  const iniciar = viaje.estado === 'asignado';
  if (iniciar && ahora < salida) return null;

  // El tiempo corre desde que el viaje inició de verdad, aunque haya sido antes de su salida programada
  const inicioReal = Number(viaje.inicio_ms);
  const inicio = !iniciar && inicioReal > 0 ? inicioReal : salida;
  const minutos = Number(viaje.duracion_min) > 0 ? Number(viaje.duracion_min) : MINUTOS_SIN_RUTA;
  const etaPrevista = inicio + minutos * 60_000 / velocidad;
  const etaGuardada = Number(viaje.eta_ms);
  const etaValida = Number.isFinite(etaGuardada) && etaGuardada > inicio;
  const eta = !etaValida ? etaPrevista : velocidad > 1 ? Math.min(etaGuardada, etaPrevista) : etaGuardada;

  const entregado = ahora >= eta;
  if (entregado) return { estado: 'entregado', avance: 100, eta, iniciar, entregado };

  const situacion = situacionDe(viaje.id);
  const tiempo = Math.max(0, (ahora - inicio) / (eta - inicio));
  const detenido = Boolean(situacion) && tiempo >= situacion.desde && tiempo < situacion.hasta;
  const calculado = Math.floor(fraccionRecorrida(tiempo, situacion) * 100);
  return {
    estado: detenido ? 'retraso' : 'en_ruta',
    avance: Math.min(Math.max(Number(viaje.avance) || 0, calculado, 1), 99),
    eta,
    iniciar,
    entregado,
    situacion: detenido ? situacion : null
  };
}

async function moverViaje(viaje, ahora = Date.now()) {
  if (viaje.gps_reciente) return;
  // Un retraso que reportó una persona sigue hasta que esa persona retome el viaje
  if (viaje.estado === 'retraso' && viaje.retraso_manual) return;
  const progreso = calcularProgreso(viaje, ahora);
  if (!progreso) return;

  const etaSql = `FROM_UNIXTIME(${Math.floor(progreso.eta / 1000)})`;
  const campos = progreso.entregado
    ? { estado: 'entregado', avance: 100, eta: { sql: etaSql }, entregado_en: { sql: etaSql } }
    : { estado: progreso.estado, avance: progreso.avance, eta: { sql: etaSql } };

  const empiezaRetraso = progreso.estado === 'retraso' && viaje.estado !== 'retraso';
  const terminaRetraso = progreso.estado === 'en_ruta' && viaje.estado === 'retraso';
  const eventos = [];
  if (progreso.iniciar) eventos.push(['en_ruta', 'Viaje iniciado automáticamente (simulación)']);
  if (empiezaRetraso) eventos.push(['retraso', `${progreso.situacion.texto} (simulación)`]);
  if (terminaRetraso) eventos.push(['en_ruta', 'Retomó el recorrido (simulación)']);
  if (progreso.avance >= 50 && viaje.avance < 50 && !progreso.entregado) {
    eventos.push(['avance', 'Va a la mitad del recorrido (simulación)']);
  }
  if (progreso.entregado) eventos.push(['entregado', 'Llegó a destino (simulación)']);

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
  } else if (empiezaRetraso) {
    avisarViaje(viaje.id, 'retraso', { nota: progreso.situacion.texto });
  } else if (terminaRetraso) {
    avisarViaje(viaje.id, 'en_ruta', { reanuda: true });
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

  console.log(`Simulador de seguimiento activo: avance según la ETA de cada viaje, cada ${segundos} s`);
}
