// Tráfico en vivo con TomTom (plan gratis: 2,500 consultas de datos y 50,000 imágenes de mapa al día).
//   Routing API → ruta para camión con el tráfico de este momento y hasta 2 alternativas
//   Traffic API → imágenes de la capa de tráfico (flujo e incidentes) para el mapa
// La clave vive en .env (TOMTOM_API_KEY) y nunca sale del servidor: las imágenes pasan por aquí.
// Para no agotar la cuota, cada viaje se consulta a lo más cada 5 minutos.
import * as viajeModel from '../models/viajeModel.js';
import { estimar } from './rutaService.js';
import { HttpError } from '../utils/httpError.js';

const ROUTING = 'https://api.tomtom.com/routing/1/calculateRoute';
const TILES = 'https://api.tomtom.com/traffic/map/4/tile';
const MINUTOS_CACHE = 5;
const LIMITE_DIARIO = 2300;            // margen debajo de las 2,500 gratis
const MAX_VIAJES = 20;                 // viajes analizados por consulta de la lista
const TARA_KG = 15000;                 // peso aproximado del tractocamión vacío (TomTom pide el peso total)
const ESTADOS_ACTIVOS = ['asignado', 'en_ruta', 'retraso'];

const claveTomTom = () => process.env.TOMTOM_API_KEY?.trim();
export const configurado = () => Boolean(claveTomTom());

/* ---------- Cuota diaria ---------- */
const uso = { dia: '', consultas: 0 };

function contarConsulta() {
  const hoy = new Date().toISOString().slice(0, 10); // TomTom reinicia la cuota en horario UTC
  if (uso.dia !== hoy) Object.assign(uso, { dia: hoy, consultas: 0 });
  if (uso.consultas >= LIMITE_DIARIO) {
    throw new HttpError(429, 'Se alcanzó el límite diario de consultas de tráfico. Se reinicia a medianoche (UTC).');
  }
  uso.consultas++;
}

export const estado = () => ({
  configurado: configurado(),
  consultas_hoy: uso.dia === new Date().toISOString().slice(0, 10) ? uso.consultas : 0,
  limite_diario: LIMITE_DIARIO,
  minutos_cache: MINUTOS_CACHE
});

/* ---------- Geometría ---------- */
function distanciaKm([lat1, lon1], [lat2, lon2]) {
  const rad = (g) => (g * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Punto del trazo que corresponde a un porcentaje del recorrido (posición simulada del camión)
function puntoEnTrazo(trazo, fraccion) {
  if (trazo.length < 2 || fraccion <= 0) return trazo[0];
  const tramos = trazo.slice(1).map((p, i) => distanciaKm(trazo[i], p));
  let restante = tramos.reduce((a, b) => a + b, 0) * Math.min(fraccion, 1);
  for (let i = 0; i < tramos.length; i++) {
    if (restante <= tramos[i]) {
      const t = tramos[i] ? restante / tramos[i] : 0;
      return [trazo[i][0] + (trazo[i + 1][0] - trazo[i][0]) * t, trazo[i][1] + (trazo[i + 1][1] - trazo[i][1]) * t];
    }
    restante -= tramos[i];
  }
  return trazo.at(-1);
}

// Menos puntos para el mapa: la ruta de TomTom trae miles
function reducir(puntos, maximo = 400) {
  if (puntos.length <= maximo) return puntos;
  const paso = (puntos.length - 1) / (maximo - 1);
  return Array.from({ length: maximo }, (_, i) => puntos[Math.round(i * paso)]);
}

/* ---------- Incidentes ---------- */
const CATEGORIAS = { JAM: 'Congestión', ROAD_WORK: 'Obras en el camino', ROAD_CLOSURE: 'Camino cerrado' };

// Causas según el estándar TPEG-TEC que usa TomTom (mainCauseCode)
const CAUSAS = {
  1: 'Congestión', 2: 'Accidente', 3: 'Obras en el camino', 4: 'Reducción de carriles',
  5: 'Camino intransitable', 6: 'Camino resbaloso', 7: 'Encharcamiento', 8: 'Incendio',
  9: 'Condiciones peligrosas', 10: 'Objetos en el camino', 11: 'Animales en el camino',
  12: 'Personas en el camino', 13: 'Vehículo descompuesto', 14: 'Vehículo en sentido contrario',
  15: 'Trabajos de rescate', 16: 'Restricción de tránsito', 17: 'Clima extremo',
  18: 'Poca visibilidad', 19: 'Lluvia', 21: 'Evento público'
};

function textoIncidente(seccion) {
  const causa = CAUSAS[seccion.tec?.causes?.[0]?.mainCauseCode];
  return CATEGORIAS[seccion.simpleCategory] || causa || 'Incidente vial';
}

/* ---------- Consulta a TomTom ---------- */
async function rutaConTrafico(desde, hasta, pesoKg) {
  contarConsulta();
  const parametros = new URLSearchParams({
    key: claveTomTom(),
    traffic: 'true',
    travelMode: 'truck',
    vehicleWeight: String(TARA_KG + (Number(pesoKg) || 0)),
    maxAlternatives: '2',
    sectionType: 'traffic',
    computeTravelTimeFor: 'all',
    routeRepresentation: 'polyline',
    language: 'es-MX'
  });
  const puntos = `${desde[0]},${desde[1]}:${hasta[0]},${hasta[1]}`;

  let respuesta;
  try {
    respuesta = await fetch(`${ROUTING}/${puntos}/json?${parametros}`, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new HttpError(503, 'El servicio de tráfico no responde. Intenta en un momento.');
  }
  if (respuesta.status === 403) throw new HttpError(502, 'TomTom rechazó la clave: revisa TOMTOM_API_KEY en Backend/.env');
  if (respuesta.status === 429) throw new HttpError(429, 'TomTom indica que se agotó la cuota de consultas por hoy.');
  if (!respuesta.ok) throw new HttpError(503, `El servicio de tráfico respondió ${respuesta.status}`);

  const datos = await respuesta.json();
  if (!datos.routes?.length) throw new HttpError(404, 'TomTom no encontró una ruta para camión entre esos puntos');
  return datos.routes;
}

function resumirRuta(ruta, indice) {
  const puntos = ruta.legs.flatMap((tramo) => tramo.points.map((p) => [p.latitude, p.longitude]));
  const s = ruta.summary;
  const incidentes = (ruta.sections || [])
    .filter((seccion) => seccion.sectionType === 'TRAFFIC')
    .map((seccion) => ({
      tipo: seccion.simpleCategory || 'OTHER',
      texto: textoIncidente(seccion),
      retraso_min: Math.round((seccion.delayInSeconds || 0) / 60),
      velocidad_kmh: seccion.effectiveSpeedInKmh ?? null,
      magnitud: seccion.magnitudeOfDelay ?? 0, // 0 desconocida · 1 leve · 2 moderada · 3 grave · 4 sin retraso (cierres, obras)
      posicion: puntos[seccion.startPointIndex] || puntos[0]
    }));

  return {
    nombre: `Ruta ${'ABC'[indice]}`,
    distancia_km: Math.round(s.lengthInMeters / 100) / 10,
    minutos: Math.round(s.travelTimeInSeconds / 60),
    minutos_sin_trafico: Math.round(s.noTrafficTravelTimeInSeconds / 60),
    retraso_min: Math.round(s.trafficDelayInSeconds / 60),
    llegada: s.arrivalTime,
    incidentes,
    trazo: reducir(puntos)
  };
}

const nivelDeRetraso = (minutos) => (minutos >= 15 ? 'pesado' : minutos >= 5 ? 'moderado' : 'fluido');

// La "habitual" es la más corta sin tráfico; la recomendada, la más rápida con el tráfico actual
function recomendar(rutas) {
  const habitual = rutas.reduce((a, b) => (b.minutos_sin_trafico < a.minutos_sin_trafico ? b : a));
  const mejor = rutas.reduce((a, b) => (b.minutos < a.minutos ? b : a));
  habitual.habitual = true;
  mejor.recomendada = true;

  const ahorro = habitual.minutos - mejor.minutos;
  if (mejor !== habitual && ahorro >= 5) {
    return { ruta: mejor.nombre, ahorro_min: ahorro, texto: `Conviene la ${mejor.nombre}: ahorra ${ahorro} min frente a la ruta habitual por el tráfico actual.` };
  }
  if (habitual.retraso_min >= 15) {
    return { ruta: habitual.nombre, ahorro_min: 0, texto: `Hay ${habitual.retraso_min} min de retraso por tráfico, pero ninguna alternativa es más rápida.` };
  }
  return { ruta: habitual.nombre, ahorro_min: 0, texto: 'La ruta habitual es la más rápida en este momento.' };
}

/* ---------- Análisis por viaje ---------- */
const cacheTrafico = new Map(); // id del viaje → { hasta, datos }

async function analizar(viaje) {
  const plan = await estimar(viaje); // dirección → coordenadas y trazo planeado (con caché)
  const enMovimiento = ['en_ruta', 'retraso'].includes(viaje.estado);
  // El tráfico se calcula para lo que falta: desde la posición actual (simulada) hasta el destino
  const posicion = puntoEnTrazo(plan.trazo, enMovimiento ? viaje.avance / 100 : 0);

  const base = {
    viaje: {
      id: viaje.id, folio: viaje.folio, origen: viaje.origen, destino: viaje.destino, estado: viaje.estado,
      avance: viaje.avance, eta: viaje.eta, salida: viaje.salida, operador: viaje.operador, placas: viaje.placas,
      peso_kg: viaje.peso_kg
    },
    origen: plan.origen,
    destino: plan.destino,
    posicion,
    planeado: plan.trazo
  };
  if (!configurado()) return { ...base, trafico: null };

  const guardado = cacheTrafico.get(viaje.id);
  if (guardado && guardado.hasta > Date.now()) return { ...base, trafico: guardado.datos };

  try {
    const rutas = (await rutaConTrafico(posicion, [plan.destino.lat, plan.destino.lon], viaje.peso_kg)).map(resumirRuta);
    const recomendacion = recomendar(rutas);
    const habitual = rutas.find((r) => r.habitual);
    const datos = {
      nivel: nivelDeRetraso(habitual.retraso_min),
      retraso_min: habitual.retraso_min,
      llegada: rutas.find((r) => r.recomendada).llegada,
      recomendacion,
      rutas,
      consultado: new Date().toISOString()
    };
    cacheTrafico.set(viaje.id, { hasta: Date.now() + MINUTOS_CACHE * 60000, datos });
    return { ...base, trafico: datos };
  } catch (error) {
    // Si TomTom falla se muestra lo último que se obtuvo, marcado como desactualizado
    if (guardado) return { ...base, trafico: { ...guardado.datos, desactualizado: true } };
    throw error;
  }
}

// Lista para el panel: un renglón por viaje activo, sin trazos (para que pese poco)
export async function viajesActivos() {
  const viajes = (await viajeModel.listar({ estados: ESTADOS_ACTIVOS })).slice(0, MAX_VIAJES);
  const resultados = await Promise.allSettled(viajes.map(analizar));

  return resultados.map((r, i) => {
    const v = viajes[i];
    if (r.status === 'rejected') {
      return { id: v.id, folio: v.folio, origen: v.origen, destino: v.destino, estado: v.estado, error: r.reason.message };
    }
    const { viaje, posicion, trafico } = r.value;
    return {
      ...viaje,
      posicion,
      nivel: trafico?.nivel ?? null,
      retraso_min: trafico?.retraso_min ?? null,
      llegada: trafico?.llegada ?? null,
      incidentes: trafico?.rutas.find((ruta) => ruta.recomendada).incidentes.length ?? null,
      ahorro_min: trafico?.recomendacion.ahorro_min ?? null,
      desactualizado: Boolean(trafico?.desactualizado)
    };
  });
}

export async function detalle(id) {
  const viaje = await viajeModel.buscarPorId(id);
  if (!viaje) throw new HttpError(404, 'El viaje no existe');
  if (!ESTADOS_ACTIVOS.includes(viaje.estado)) throw new HttpError(409, 'El tráfico solo se consulta para viajes asignados o en ruta');
  return analizar(viaje);
}

/* ---------- Imágenes de la capa de tráfico ---------- */
const CAPAS = { flujo: 'flow/relative0', incidentes: 'incidents/s3' };
const cacheTiles = new Map(); // "capa/z/x/y" → { hasta, imagen }
const MAX_TILES = 1500;

export async function tile(capa, z, x, y) {
  [z, x, y] = [z, x, y].map(Number);
  const valido = CAPAS[capa] && [z, x, y].every(Number.isInteger) && z >= 0 && z <= 18
    && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;
  if (!valido) throw new HttpError(404, 'Imagen de tráfico no válida');
  if (!configurado()) throw new HttpError(503, 'Falta TOMTOM_API_KEY en Backend/.env');

  const llave = `${capa}/${z}/${x}/${y}`;
  const guardada = cacheTiles.get(llave);
  if (guardada && guardada.hasta > Date.now()) return guardada.imagen;

  let respuesta;
  try {
    respuesta = await fetch(`${TILES}/${CAPAS[capa]}/${z}/${x}/${y}.png?key=${claveTomTom()}`, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw new HttpError(503, 'El servicio de tráfico no responde');
  }
  if (!respuesta.ok) throw new HttpError(502, `TomTom respondió ${respuesta.status}`);

  const imagen = Buffer.from(await respuesta.arrayBuffer());
  cacheTiles.delete(llave);
  cacheTiles.set(llave, { hasta: Date.now() + 2 * 60000, imagen });
  if (cacheTiles.size > MAX_TILES) cacheTiles.delete(cacheTiles.keys().next().value); // sale la más antigua
  return imagen;
}
