// Consultas a los servicios de mapas, sin salir a internet: fetch se reemplaza por respuestas de prueba.
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';

const fetchReal = globalThis.fetch;
const errorReal = console.error;
const LUGAR = [{ lat: '19.04', lon: '-98.20', display_name: 'Lugar de prueba' }];
const RUTA = { code: 'Ok', routes: [{ duration: 3600, distance: 100000, geometry: { coordinates: [[-98.2, 19.04], [-99.1, 19.4]] } }] };
const json = (datos, status = 200) => new Response(JSON.stringify(datos), { status });

let estimar;
let pedidas;
let serie = 0;
let registros;

// Cada prueba usa direcciones distintas para no leer las de la caché
const direcciones = () => { serie++; return { origen: `Origen ${serie}`, destino: `Destino ${serie}` }; };
const conFallas = (fallas) => {
  pedidas = 0;
  globalThis.fetch = async (url) => {
    pedidas++;
    if (fallas.length) {
      const falla = fallas.shift();
      if (falla === 'red') throw new TypeError('fetch failed');
      return json({}, falla);
    }
    return json(String(url).includes('nominatim') ? LUGAR : RUTA);
  };
};

before(async () => {
  ({ estimar } = await import('../src/services/viajes/rutaService.js'));
});
beforeEach(() => {
  registros = [];
  console.error = (...partes) => registros.push(partes.join(' '));
});
after(() => {
  globalThis.fetch = fetchReal;
  console.error = errorReal;
});

test('una falla temporal del servicio se reintenta', async () => {
  conFallas([503, 'red']);
  const ruta = await estimar(direcciones());
  assert.equal(ruta.distancia_km, 100);
  assert.equal(pedidas, 5); // lugar con 2 fallas + lugar + ruta
});

test('si el servicio sigue fallando responde 503 y deja el motivo en el registro', async () => {
  conFallas([429, 429, 429]);
  await assert.rejects(estimar(direcciones()), { status: 503 });
  assert.equal(pedidas, 3);
  assert.match(registros.join(), /429/);
});

test('un rechazo definitivo no se reintenta', async () => {
  conFallas([403]);
  await assert.rejects(estimar(direcciones()), { status: 503 });
  assert.equal(pedidas, 1);
  assert.match(registros.join(), /403/);
});
