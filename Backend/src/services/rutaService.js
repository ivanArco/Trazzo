// Estimación de ruta con servicios libres de OpenStreetMap (sin API key):
//   Nominatim → convierte la dirección en coordenadas
//   OSRM      → calcula el recorrido por carretera (distancia y tiempo en auto)
// Los servidores públicos piden uso moderado, por eso todo se guarda en caché en memoria.
import { HttpError } from '../utils/httpError.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const AGENTE = 'Trazzo/1.0 (proyecto escolar de logistica)'; // Nominatim exige identificar la app

const VELOCIDAD_MINIMA_KMH = 10;
const VELOCIDAD_MAXIMA_KMH = 120;
const FACTOR_RESTRICCION_MAXIMO = 3;

function configuracionNumerica(nombre, predeterminado, minimo, maximo) {
  const valor = Number(process.env[nombre] ?? predeterminado);
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new Error(`${nombre} debe estar entre ${minimo} y ${maximo}`);
  }
  return valor;
}

const VELOCIDAD_PROMEDIO_KMH = configuracionNumerica(
  'VELOCIDAD_PROMEDIO_CAMION_KMH', 65, VELOCIDAD_MINIMA_KMH, VELOCIDAD_MAXIMA_KMH
);
const FACTOR_RESTRICCION_RUTA = configuracionNumerica('FACTOR_RESTRICCION_RUTA', 1, 1, FACTOR_RESTRICCION_MAXIMO);

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

function parametroNumerico(valor, nombre, predeterminado, minimo, maximo) {
  if (valor === undefined || valor === null || valor === '') return predeterminado;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < minimo || numero > maximo) {
    throw new HttpError(400, `${nombre} debe estar entre ${minimo} y ${maximo}`);
  }
  return numero;
}

function parametrosCamion(datos = {}) {
  return {
    velocidad_promedio_kmh: parametroNumerico(
      datos.velocidad_promedio_kmh,
      'La velocidad promedio',
      VELOCIDAD_PROMEDIO_KMH,
      VELOCIDAD_MINIMA_KMH,
      VELOCIDAD_MAXIMA_KMH
    ),
    factor_restriccion: parametroNumerico(
      datos.factor_restriccion,
      'El factor de restricción',
      FACTOR_RESTRICCION_RUTA,
      1,
      FACTOR_RESTRICCION_MAXIMO
    )
  };
}

function calcularDuracion(distanciaKm, { velocidad_promedio_kmh, factor_restriccion }) {
  return {
    duracion_min: Math.round((distanciaKm / velocidad_promedio_kmh) * 60 * factor_restriccion),
    velocidad_promedio_kmh,
    factor_restriccion
  };
}

const distanciaEntre = ([latA, lonA], [latB, lonB]) => {
  const radianes = Math.PI / 180;
  const dLat = (latB - latA) * radianes;
  const dLon = (lonB - lonA) * radianes;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(latA * radianes) * Math.cos(latB * radianes) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export function progresoEnRuta(trazo, ubicacion) {
  if (!Array.isArray(trazo) || trazo.length < 2) return null;
  const segmentos = trazo.slice(1).map((punto, i) => distanciaEntre(trazo[i], punto));
  const totalKm = segmentos.reduce((total, segmento) => total + segmento, 0);
  if (!totalKm) return { avance: 100, restante_km: 0 };

  const acumuladas = [0];
  segmentos.forEach((segmento) => acumuladas.push(acumuladas.at(-1) + segmento));
  let restanteKm = totalKm;
  let distanciaMasCorta = Infinity;
  const latitudMedia = ubicacion[0] * Math.PI / 180;
  const escalaX = 111.32 * Math.cos(latitudMedia);
  const escalaY = 110.574;
  for (let i = 0; i < segmentos.length; i++) {
    const inicio = trazo[i];
    const fin = trazo[i + 1];
    const dx = (fin[1] - inicio[1]) * escalaX;
    const dy = (fin[0] - inicio[0]) * escalaY;
    const px = (ubicacion[1] - inicio[1]) * escalaX;
    const py = (ubicacion[0] - inicio[0]) * escalaY;
    const proporcion = dx || dy ? Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy))) : 0;
    const proyeccion = [inicio[0] + (fin[0] - inicio[0]) * proporcion, inicio[1] + (fin[1] - inicio[1]) * proporcion];
    const desviacion = distanciaEntre(ubicacion, proyeccion);
    if (desviacion < distanciaMasCorta) {
      distanciaMasCorta = desviacion;
      restanteKm = Math.min(totalKm, totalKm - acumuladas[i] - segmentos[i] * proporcion + desviacion);
    }
  }

  return {
    avance: Math.max(0, Math.min(100, Math.round((1 - restanteKm / totalKm) * 100))),
    restante_km: restanteKm
  };
}

export function calcularDuracionCamion(distanciaKm, datos = {}) {
  if (!Number.isFinite(distanciaKm) || distanciaKm < 0) {
    throw new HttpError(400, 'La distancia de la ruta no es válida');
  }
  return calcularDuracion(distanciaKm, parametrosCamion(datos));
}

export async function estimar(datos = {}) {
  const { origen, destino, gps_origen, gps_destino } = datos;
  if (!origen?.trim() || !destino?.trim()) throw new HttpError(400, 'Escribe el origen y el destino');
  const parametros = parametrosCamion(datos);

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
  const distanciaRealKm = ruta.distance / 1000;
  const distanciaKm = Math.round(distanciaRealKm * 10) / 10;
  const duracion = calcularDuracion(distanciaRealKm, parametros);
  return {
    origen: a,
    destino: b,
    distancia_km: distanciaKm,
    duracion_auto_min: minutosAuto,
    ...duracion,
    // GeoJSON da [lon, lat]; Leaflet usa [lat, lon]
    trazo: ruta.geometry.coordinates.map(([lon, lat]) => [lat, lon])
  };
}
