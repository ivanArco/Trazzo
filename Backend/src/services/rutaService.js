// Estimación de ruta con servicios libres de OpenStreetMap (sin API key):
//   Nominatim → convierte la dirección en coordenadas
//   OSRM      → calcula el recorrido por carretera (distancia y tiempo en auto)
// Los servidores públicos piden uso moderado, por eso todo se guarda en caché en memoria.
import { HttpError } from '../utils/httpError.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const AGENTE = 'Trazzo/1.0 (proyecto escolar de logistica)'; // Nominatim exige identificar la app

// Un camión de carga va más lento que un auto (velocidad máxima, casetas, pendientes)
export const FACTOR_CAMION = 1.3;

const cacheLugares = new Map();
const cacheRutas = new Map();

// Nominatim permite 1 petición por segundo: se forman en fila
let fila = Promise.resolve();
const turnoNominatim = () => {
  const turno = fila.then(() => new Promise((r) => setTimeout(r, 1000)));
  fila = turno;
  return turno;
};

async function pedirJson(url, opciones = {}) {
  const respuesta = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(10000), ...opciones });
  if (!respuesta.ok) throw new Error(`Servicio de mapas respondió ${respuesta.status}`);
  return respuesta.json();
}

// Coordenadas dentro de un enlace de mapas: ...@19.04,-98.20... o ...?q=19.04,-98.20
function coordenadasDeTexto(texto) {
  const m = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(decodeURIComponent(texto || ''));
  return m ? { lat: Number(m[1]), lon: Number(m[2]) } : null;
}

// Enlace de Google Maps (incluye los cortos maps.app.goo.gl, que se siguen hasta la dirección final)
async function lugarDesdeEnlace(enlace) {
  if (!enlace) return null;
  let coordenadas = coordenadasDeTexto(enlace);
  if (!coordenadas && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl)\//i.test(enlace)) {
    try {
      const respuesta = await fetch(enlace, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
      coordenadas = coordenadasDeTexto(respuesta.url);
    } catch { /* si falla, se usa la dirección escrita */ }
  }
  return coordenadas && { ...coordenadas, nombre: 'Ubicación del enlace GPS' };
}

async function buscarEnNominatim(texto, soloCiudades = false) {
  await turnoNominatim();
  const parametros = { q: texto, format: 'jsonv2', limit: '1', countrycodes: 'mx', 'accept-language': 'es' };
  if (soloCiudades) parametros.featureType = 'city'; // "Puebla" → la ciudad, no el centro del estado
  const url = `${NOMINATIM}?${new URLSearchParams(parametros)}`;
  const [lugar] = await pedirJson(url);
  return lugar;
}

// Si no se encuentra la dirección completa ("Parque Industrial FINSA, Puebla"), se intenta
// quitando lo de la izquierda hasta llegar a la ciudad ("Puebla") y se marca como aproximada
async function geocodificar(direccion) {
  const clave = direccion.trim().toLowerCase();
  if (cacheLugares.has(clave)) return cacheLugares.get(clave);

  const partes = direccion.split(',').map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < partes.length; i++) {
    const texto = partes.slice(i).join(', ');
    const lugar = i === 0
      ? await buscarEnNominatim(texto)
      : (await buscarEnNominatim(texto, true)) || (await buscarEnNominatim(texto));
    if (lugar) {
      const resultado = { lat: Number(lugar.lat), lon: Number(lugar.lon), nombre: lugar.display_name, aproximado: i > 0 };
      cacheLugares.set(clave, resultado);
      return resultado;
    }
  }
  throw new HttpError(404, `No encontramos "${direccion}" en el mapa. Prueba con "colonia o lugar, ciudad".`);
}

export async function estimar({ origen, destino, gps_origen, gps_destino } = {}) {
  if (!origen?.trim() || !destino?.trim()) throw new HttpError(400, 'Escribe el origen y el destino');

  let a;
  let b;
  try {
    a = (await lugarDesdeEnlace(gps_origen)) || (await geocodificar(origen));
    b = (await lugarDesdeEnlace(gps_destino)) || (await geocodificar(destino));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'El servicio de mapas no responde. Intenta en un momento.');
  }

  const clave = [a.lat, a.lon, b.lat, b.lon].map((n) => n.toFixed(4)).join(',');
  if (!cacheRutas.has(clave)) {
    let datos;
    try {
      datos = await pedirJson(`${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=simplified&geometries=geojson`);
    } catch {
      throw new HttpError(503, 'El servicio de rutas no responde. Intenta en un momento.');
    }
    const ruta = datos.routes?.[0];
    if (datos.code !== 'Ok' || !ruta) throw new HttpError(404, 'No hay un camino por carretera entre esos dos puntos');
    cacheRutas.set(clave, ruta);
  }

  const ruta = cacheRutas.get(clave);
  const minutosAuto = Math.round(ruta.duration / 60);
  return {
    origen: a,
    destino: b,
    distancia_km: Math.round(ruta.distance / 100) / 10,
    duracion_auto_min: minutosAuto,
    duracion_min: Math.round(minutosAuto * FACTOR_CAMION),
    // GeoJSON da [lon, lat]; Leaflet usa [lat, lon]
    trazo: ruta.geometry.coordinates.map(([lon, lat]) => [lat, lon])
  };
}
