// Rastreo público: cada viaje puede tener un enlace secreto (y su código QR) que el cliente
// abre sin cuenta para ver el avance en vivo. El enlace se puede desactivar en cualquier momento.
import crypto from 'node:crypto';
import os from 'node:os';
import QRCode from 'qrcode';
import * as viajeModel from '../models/viajeModel.js';
import { estimar } from './rutaService.js';
import { iaDisponible } from './asistenteService.js';
import { pushDisponible, clavePublica, olvidarEnvio } from './notificacionService.js';
import { HttpError } from '../utils/httpError.js';

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{43}$/;
const HORAS_VISIBLE_TRAS_ENTREGA = 72;

const RED_LOCAL = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// IP de la computadora en la red local (para que el QR funcione desde un celular en el mismo wifi).
// Se saltan los adaptadores virtuales (WSL, Hyper-V, VirtualBox…) y se prefiere la del wifi de casa (192.168.x.x).
function ipLocal() {
  const candidatas = [];
  for (const [nombre, interfaces] of Object.entries(os.networkInterfaces())) {
    if (/vEthernet|VirtualBox|VMware|WSL|Docker|Hyper-V/i.test(nombre)) continue;
    for (const red of interfaces || []) {
      if (red.family === 'IPv4' && !red.internal) candidatas.push(red.address);
    }
  }
  return candidatas.find((ip) => ip.startsWith('192.168.')) || candidatas[0] || null;
}

// Dirección base para armar el enlace del QR:
//   1. PUBLIC_URL en .env
//   2. la dirección pública desde la que se usa la app, con su carpeta (p. ej. usuario.gitlab.io/trazzo/)
//   3. en desarrollo: este mismo servidor con la IP del wifi, que también sirve rastreo.html.
//      Así el celular lo abre aunque el frontend corra en Live Server (que solo atiende a esta computadora).
function urlBase(base) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  try {
    const url = new URL(base);
    if (['http:', 'https:'].includes(url.protocol) && !RED_LOCAL.test(url.hostname)) {
      return (url.origin + url.pathname).replace(/\/$/, '');
    }
  } catch { /* sin dirección del frontend */ }
  return `http://${ipLocal() || 'localhost'}:${process.env.PORT || 3000}`;
}

export async function activar(id, base) {
  const viaje = await viajeModel.buscarPorId(id);
  if (!viaje) throw new HttpError(404, 'El viaje no existe');
  if (viaje.estado === 'cancelado') throw new HttpError(409, 'El viaje está cancelado');

  // Se reutiliza el token si ya existía: el QR impreso sigue funcionando
  let token = await viajeModel.tokenDeRastreo(id);
  if (!token) {
    token = crypto.randomBytes(32).toString('base64url'); // 43 caracteres, imposible de adivinar
    await viajeModel.actualizar(id, { rastreo_token: token });
  }

  const url = `${urlBase(base)}/rastreo.html?t=${token}`;
  const qr = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b0f17', light: '#ffffff' }
  });
  return { folio: viaje.folio, url, qr_svg: qr };
}

export async function desactivar(id) {
  const viaje = await viajeModel.buscarPorId(id);
  if (!viaje) throw new HttpError(404, 'El viaje no existe');
  await viajeModel.actualizar(id, { rastreo_token: null });
  await olvidarEnvio(id); // el cliente deja de recibir notificaciones de este envío
  return { folio: viaje.folio, rastreo_activo: false };
}

// Textos para el cliente: no se muestran notas internas ni nombres del personal de oficina
const EVENTO_PUBLICO = {
  creado: 'Pedido registrado',
  asignado: 'Operador y unidad asignados',
  en_ruta: 'En camino',
  retraso: 'Se reportó un retraso',
  avance: 'Va a la mitad del recorrido',
  entregado: 'Entregado',
  cancelado: 'Viaje cancelado'
};

const nombreDeOperador = (nombre) => {
  const [primero, apellido] = (nombre || '').trim().split(/\s+/);
  return primero ? `${primero}${apellido ? ` ${apellido[0]}.` : ''}` : null;
};

export async function vistaPublica(token) {
  if (!TOKEN_VALIDO.test(token || '')) throw new HttpError(404, 'Enlace de rastreo no válido');

  const viaje = await viajeModel.buscarPorToken(token);
  if (!viaje) throw new HttpError(404, 'Este enlace de rastreo no existe o fue desactivado');
  if (viaje.estado === 'cancelado') throw new HttpError(410, 'Este viaje fue cancelado');
  if (viaje.entregado_en && Date.now() - new Date(viaje.entregado_en) > HORAS_VISIBLE_TRAS_ENTREGA * 3600000) {
    throw new HttpError(410, 'Este enlace expiró: el viaje se entregó hace más de 3 días');
  }

  // El trazo del mapa sale de la caché de rutas; si el servicio de mapas falla, se omite
  let ruta = null;
  try {
    const r = await estimar(viaje);
    ruta = { origen: r.origen, destino: r.destino, trazo: r.trazo };
  } catch { /* la página funciona sin mapa */ }

  const eventos = await viajeModel.eventosDeViaje(viaje.id);
  return {
    folio: viaje.folio,
    origen: viaje.origen,
    destino: viaje.destino,
    mercancia: viaje.mercancia,
    estado: viaje.estado,
    avance: viaje.avance,
    salida: viaje.salida,
    eta: viaje.eta,
    entregado_en: viaje.entregado_en,
    distancia_km: viaje.distancia_km,
    duracion_min: viaje.duracion_min,
    operador: nombreDeOperador(viaje.operador),
    ruta,
    eventos: eventos.map((e) => ({ tipo: e.tipo, texto: EVENTO_PUBLICO[e.tipo] || 'Actualización', fecha: e.creado_en })),
    asistente: iaDisponible(), // la página muestra «Pregunta sobre tu envío» solo si hay IA configurada
    push: pushDisponible() ? clavePublica() : null // clave para el botón «Avísame» (notificaciones)
  };
}
