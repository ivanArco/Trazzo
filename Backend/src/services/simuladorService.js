// Seguimiento SIMULADO (solo de prueba): mientras no haya GPS real, cada cierto tiempo
// avanza los viajes en ruta, a veces provoca un retraso y al llegar al 100 % los entrega.
import { enTransaccion } from '../config/db.js';
import * as viajeModel from '../models/viajeModel.js';
import * as flotaModel from '../models/flotaModel.js';
import { camposPorEstado } from './viajeService.js';
import { avisarViaje } from './notificacionService.js';

const CERCA_DEL_DESTINO = 90; // % del recorrido a partir del cual se avisa «está por llegar»

const azar = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

async function moverViaje(viaje) {
  let estado = viaje.estado;
  let avance = viaje.avance;
  let evento = null;

  if (estado === 'en_ruta') {
    avance += azar(3, 8);
    if (avance < 90 && Math.random() < 0.08) {
      estado = 'retraso';
      evento = ['retraso', 'Tráfico detectado en el trayecto (simulación)'];
    }
  } else {
    avance += azar(0, 2);
    if (Math.random() < 0.35) {
      estado = 'en_ruta';
      evento = ['en_ruta', 'Recuperó la velocidad normal (simulación)'];
    }
  }

  if (avance >= 100) {
    estado = 'entregado';
    evento = ['entregado', 'Llegó a destino (simulación)'];
  } else if (!evento && viaje.avance < 50 && avance >= 50) {
    evento = ['avance', 'Va a la mitad del recorrido'];
  }

  await enTransaccion(async (conexion) => {
    await viajeModel.actualizar(viaje.id, camposPorEstado(viaje, estado, Math.min(avance, 100)), conexion);
    if (estado === 'entregado' && viaje.unidad_id) {
      await flotaModel.cambiarEstadoUnidad(viaje.unidad_id, 'disponible', conexion);
    }
    if (evento) await viajeModel.registrarEvento(viaje.id, evento[0], evento[1], null, conexion);
  });

  // Notificaciones: cambios de estado y el momento en que cruza el 90 % del recorrido
  if (evento && ['en_ruta', 'retraso', 'entregado'].includes(evento[0])) {
    avisarViaje(viaje.id, evento[0], { reanuda: evento[0] === 'en_ruta' });
  } else if (estado !== 'entregado' && viaje.avance < CERCA_DEL_DESTINO && avance >= CERCA_DEL_DESTINO) {
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

  console.log(`Simulador de seguimiento activo: avanza los viajes cada ${segundos} s`);
}
