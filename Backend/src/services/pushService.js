// Notificaciones push (estándar Web Push). El navegador del usuario se suscribe con la clave pública
// VAPID y nos entrega su «endpoint»; para avisarle, el servidor cifra el mensaje y lo envía a ese
// endpoint (servicio push de Google, Mozilla, Microsoft o Apple), que lo entrega al Service Worker
// aunque la app esté cerrada. La clave privada VAPID firma cada envío y nunca sale del servidor.
import webpush from 'web-push';
import * as pushModel from '../models/pushModel.js';
import { HttpError } from '../utils/httpError.js';

let configurado = false;
const claves = () => ({
  publica: process.env.VAPID_PUBLIC_KEY?.trim(),
  privada: process.env.VAPID_PRIVATE_KEY?.trim(),
  sujeto: process.env.VAPID_SUBJECT?.trim() || 'mailto:soporte@trazzo.mx'
});

function prepararWebPush() {
  if (configurado) return true;
  const { publica, privada, sujeto } = claves();
  if (!publica || !privada) return false;
  webpush.setVapidDetails(sujeto, publica, privada);
  configurado = true;
  return true;
}

export const estado = () => ({ configurado: prepararWebPush(), clave_publica: claves().publica || null });

// La suscripción que entrega el navegador: { endpoint, keys: { p256dh, auth } }
export async function suscribir(datos = {}, usuario, navegador) {
  if (!prepararWebPush()) throw new HttpError(503, 'Las notificaciones push no están configuradas (faltan las claves VAPID en Backend/.env)');
  const endpoint = String(datos.endpoint || '');
  const { p256dh, auth } = datos.keys || {};
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 700 || !p256dh || !auth) {
    throw new HttpError(400, 'La suscripción del navegador no es válida');
  }
  await pushModel.guardar({ usuario_id: usuario.id, endpoint, p256dh: String(p256dh), auth: String(auth), navegador: navegador?.slice(0, 255) || null });
  return { suscrito: true, dispositivos: await pushModel.contarDeUsuario(usuario.id) };
}

export async function desuscribir(datos = {}, usuario) {
  const endpoint = String(datos.endpoint || '');
  if (!endpoint) throw new HttpError(400, 'Falta el endpoint de la suscripción');
  await pushModel.eliminar(endpoint, usuario.id);
  return { suscrito: false, dispositivos: await pushModel.contarDeUsuario(usuario.id) };
}

// Envía a una lista de suscripciones. Las que el servicio push da por vencidas (404 o 410) se borran.
async function enviar(suscripciones, notificacion) {
  if (!prepararWebPush() || !suscripciones.length) return { enviadas: 0, fallidas: 0, eliminadas: 0 };
  const cuerpo = JSON.stringify(notificacion);
  const resultados = await Promise.allSettled(suscripciones.map((s) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, {
      TTL: notificacion.ttl ?? 60 * 60,           // si el dispositivo está apagado, se guarda hasta 1 hora
      urgency: notificacion.urgencia || 'normal'  // 'high' despierta al teléfono de inmediato
    })));

  let eliminadas = 0;
  let fallidas = 0;
  await Promise.all(resultados.map(async (r, i) => {
    if (r.status === 'fulfilled') return;
    if ([404, 410].includes(r.reason?.statusCode)) {
      await pushModel.eliminarPorId(suscripciones[i].id);
      eliminadas++;
    } else {
      fallidas++;
      console.error('Push no enviada:', r.reason?.statusCode || '', r.reason?.body || r.reason?.message);
    }
  }));
  return { enviadas: resultados.length - fallidas - eliminadas, fallidas, eliminadas };
}

export const enviarAUsuario = async (usuarioId, notificacion) => enviar(await pushModel.deUsuario(usuarioId), notificacion);
export const enviarARoles = async (roles, notificacion) => enviar(await pushModel.deRoles(roles), notificacion);

// Botón «Enviar prueba»: le llega solo al usuario que la pide, en todos sus dispositivos
export async function prueba(usuario) {
  if (!prepararWebPush()) throw new HttpError(503, 'Las notificaciones push no están configuradas');
  const resultado = await enviarAUsuario(usuario.id, {
    titulo: 'Trazzo · notificación de prueba',
    cuerpo: `Hola, ${usuario.nombre}. Las notificaciones de Trazzo funcionan en este dispositivo.`,
    url: './#tablero',
    etiqueta: 'trazzo-prueba'
  });
  if (!resultado.enviadas && !resultado.fallidas) throw new HttpError(409, 'Este usuario no tiene dispositivos con notificaciones activadas');
  return resultado;
}
