// Notificaciones push (Web Push con claves VAPID): avisan cuando un viaje se asigna, inicia, cambia de estado,
// está por llegar (90 % del recorrido) o se entrega.
// Solo a los involucrados en ESE viaje:
//   · quien lo creó y quien lo asignó (oficina) · el chofer (operador) · el chofer anterior si se reasigna
//   · el cliente que sigue el envío en rastreo.html (textos públicos, sin notas internas)
// Los avisos se mandan en segundo plano: si el envío falla, el cambio del viaje no se ve afectado.
import webpush from 'web-push';
import * as suscripcionModel from '../models/suscripcionModel.js';
import * as viajeModel from '../models/viajeModel.js';
import { HttpError } from '../utils/httpError.js';

const PUBLICA = process.env.VAPID_PUBLIC_KEY?.trim();
const PRIVADA = process.env.VAPID_PRIVATE_KEY?.trim();

export const pushDisponible = () => Boolean(PUBLICA && PRIVADA);
export const clavePublica = () => PUBLICA || null;

if (pushDisponible()) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:soporte@trazzo.example', PUBLICA, PRIVADA);
}

export const CERCA_DEL_DESTINO = 90; // % del recorrido a partir del cual se avisa «está por llegar»

// Solo servicios push reales (Chrome, Firefox, Edge, Safari): el servidor envía peticiones a esa dirección,
// así que no se aceptan direcciones arbitrarias (evita que la ruta pública se use para llegar a otros servidores)
const SERVICIO_PUSH = /^https:\/\/([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)\//i;

/* ---------- Suscripciones ---------- */
// usuarioId: personal con sesión (viajeId = 0) · viajeId: cliente que sigue ese envío
export async function suscribir(suscripcion, { usuarioId = null, viajeId = 0 } = {}) {
  if (!pushDisponible()) throw new HttpError(503, 'Las notificaciones no están configuradas en el servidor (faltan las claves VAPID en .env).');
  const { endpoint, keys } = suscripcion || {};
  if (typeof endpoint !== 'string' || endpoint.length > 600 || !SERVICIO_PUSH.test(endpoint)
    || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
    throw new HttpError(400, 'La suscripción de notificaciones no es válida');
  }
  await suscripcionModel.guardar({ endpoint, p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100), usuarioId, viajeId });
  return { ok: true };
}

export async function cancelar(endpoint, { viajeId = 0 } = {}) {
  if (typeof endpoint !== 'string') throw new HttpError(400, 'Falta la suscripción');
  await suscripcionModel.eliminar(endpoint, viajeId);
  return { ok: true };
}

// Al desactivar el rastreo, el cliente deja de recibir avisos de ese envío
export async function olvidarEnvio(viajeId) {
  if (!pushDisponible()) return;
  await suscripcionModel.eliminarDeViaje(viajeId);
}

/* ---------- Textos ---------- */
const ciudad = (texto) => (texto || '').split(',').pop().trim() || texto;
const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtFecha = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const hora = (f) => (f ? fmtHora.format(new Date(f)) : null);
const fecha = (f) => (f ? fmtFecha.format(new Date(f)).replace(/\./g, '') : '—');

// interno: oficina (y operador si no hay texto propio) · operador: el operador del viaje · cliente: rastreo público
function textos(tipo, v, { reanuda, nota }) {
  const ruta = `${ciudad(v.origen)} → ${ciudad(v.destino)}`;
  const llega = hora(v.eta) ? ` Llegada estimada: ${hora(v.eta)}.` : '';
  switch (tipo) {
    case 'asignado':
      return {
        interno: { title: `${v.folio} asignado`, body: `${ruta} · ${v.operador || 'Operador'} · unidad ${v.placas || '—'}` },
        operador: { title: `Nuevo viaje: ${v.folio}`, body: `${ruta}. Unidad ${v.placas || '—'}. Salida: ${fecha(v.salida)}.` },
        retirado: { title: `${v.folio} se reasignó`, body: `Ya no tienes este viaje (${ruta}). Ahora lo lleva ${v.operador || 'otro operador'}.` },
        cliente: { title: `Tu envío ${v.folio} ya tiene camión`, body: `Asignamos operador y unidad. Salida programada: ${fecha(v.salida)}.` }
      };
    case 'en_ruta':
      return reanuda
        ? {
          interno: { title: `${v.folio} recuperó el ritmo`, body: `${ruta}.${llega}` },
          cliente: { title: `Tu envío ${v.folio} sigue en camino`, body: `El retraso quedó atrás.${llega}` }
        }
        : {
          interno: { title: `${v.folio} inició su viaje`, body: `${ruta}.${llega}` },
          cliente: { title: `¡Tu envío ${v.folio} va en camino!`, body: `Salió de ${ciudad(v.origen)}.${llega}` }
        };
    case 'retraso':
      return {
        interno: { title: `${v.folio} con retraso`, body: `${ruta}.${nota ? ` ${nota}.` : ''}${llega}` },
        cliente: { title: `Tu envío ${v.folio} presenta un retraso`, body: `Seguimos en camino a ${ciudad(v.destino)}.${llega}` }
      };
    case 'cerca':
      return {
        interno: { title: `${v.folio} está por llegar`, body: `${v.avance} % del recorrido a ${ciudad(v.destino)}.${llega}` },
        cliente: { title: `Tu envío ${v.folio} está por llegar`, body: `Ya va muy cerca de ${ciudad(v.destino)}.${llega}` }
      };
    case 'entregado':
      return {
        interno: { title: `${v.folio} entregado`, body: `${ruta}. Entrega confirmada.` },
        cliente: { title: `¡Tu envío ${v.folio} fue entregado!`, body: `Llegó a ${ciudad(v.destino)}. Gracias por confiar en nosotros.` }
      };
    case 'cancelado':
      return { interno: { title: `${v.folio} cancelado`, body: `${ruta}.${nota ? ` ${nota}.` : ''}` } };
    default:
      return null;
  }
}

/* ---------- Envío ---------- */
// actorId: quien hizo el cambio no recibe su propio aviso (ya lo ve en pantalla)
// anteriorOperadorId: al reasignar, el chofer que tenía el viaje recibe «ya no tienes este viaje»
export function avisarViaje(viajeId, tipo, { actorId = null, reanuda = false, nota = '', anteriorOperadorId = null } = {}) {
  if (!pushDisponible()) return;
  enviar(viajeId, tipo, { actorId, reanuda, nota, anteriorOperadorId })
    .catch((error) => console.error('Notificaciones:', error.message));
}

// Personal involucrado en el viaje: quien lo creó, quien lo asignó (último evento «asignado») y el chofer
async function involucrados(viaje, anteriorOperadorId) {
  const datos = await viajeModel.responsables(viaje.id);
  const retirado = anteriorOperadorId && anteriorOperadorId !== viaje.operador_id ? anteriorOperadorId : null;
  return {
    ids: [...new Set([datos?.creado_por, datos?.asignado_por, viaje.operador_id, retirado].filter(Boolean))],
    retirado
  };
}

async function enviar(viajeId, tipo, { actorId, reanuda, nota, anteriorOperadorId }) {
  const viaje = await viajeModel.buscarPorId(viajeId);
  const mensaje = viaje && textos(tipo, viaje, { reanuda, nota: nota?.trim().slice(0, 120) });
  if (!mensaje) return;

  const { ids, retirado } = await involucrados(viaje, tipo === 'asignado' ? anteriorOperadorId : null);
  const suscripciones = await suscripcionModel.deViajeYUsuarios(viaje.id, ids);
  if (!suscripciones.length) return;
  const token = mensaje.cliente ? await viajeModel.tokenDeRastreo(viaje.id) : null;

  await Promise.all(suscripciones.map(async (s) => {
    let aviso;
    let url;
    if (s.viaje_id) {
      if (!token || !mensaje.cliente) return;
      aviso = mensaje.cliente;
      url = `rastreo.html?t=${token}`;
    } else {
      if (s.usuario_id === actorId) return;
      if (s.usuario_id === retirado) aviso = mensaje.retirado;
      else if (s.usuario_id === viaje.operador_id) aviso = mensaje.operador || mensaje.interno;
      else aviso = mensaje.interno;
      url = './#monitoreo';
    }

    await entregar(s, { ...aviso, url, tag: viaje.folio }, { TTL: 6 * 3600, urgency: ['cerca', 'retraso'].includes(tipo) ? 'high' : 'normal' });
  }));
}

async function entregar(s, aviso, opciones) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), opciones);
  } catch (error) {
    // 404/410: el navegador canceló la suscripción; se borra para no volver a intentarlo
    if ([404, 410].includes(error.statusCode)) await suscripcionModel.eliminarPorId(s.id);
    else console.error('Notificaciones: no se pudo enviar un aviso', error.statusCode || error.message);
  }
}

// Alerta urgente para todo el personal con esos roles (botón de pánico), aunque no esté ligado al viaje
export function avisarRoles(roles, aviso) {
  if (!pushDisponible()) return;
  enviarARoles(roles, aviso).catch((error) => console.error('Notificaciones:', error.message));
}

async function enviarARoles(roles, aviso) {
  const suscripciones = await suscripcionModel.deRoles(roles);
  await Promise.all(suscripciones.map((s) => entregar(s, aviso, { TTL: 24 * 3600, urgency: 'high' })));
}
