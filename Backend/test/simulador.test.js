// Viajes simulados: duración fija y situaciones. No necesita base de datos.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';

const ahora = Date.now();
let calcular;
let situacionDe;

// Viaje iniciado hace `segundos`, en una simulación de 20 s
const a = (id, segundos, datos = {}) => calcular({
  id, estado: 'en_ruta', avance: 1, inicio_ms: ahora - segundos * 1000, ...datos
}, ahora, 20);

before(async () => {
  ({ calcularProgreso: calcular, situacionDe } = await import('../src/services/viajes/simuladorService.js'));
});

test('un viaje asignado se inicia solo, aunque su salida programada sea futura', () => {
  const p = calcular({ id: 7, estado: 'asignado', avance: 0, salida_ms: ahora + 72_000_000 }, ahora, 20);
  assert.equal(p.iniciar, true);
  assert.equal(p.estado, 'en_ruta');
  assert.equal(p.eta, ahora + 20_000);
});

test('todos los viajes terminan a los 20 segundos', () => {
  for (let id = 1; id <= 14; id++) {
    assert.equal(a(id, 19.9).entregado, false, `viaje ${id} antes de tiempo`);
    assert.equal(a(id, 20).estado, 'entregado', `viaje ${id} a tiempo`);
    assert.equal(a(id, 20).avance, 100);
  }
});

test('un viaje sin situación avanza parejo y sin retrasos', () => {
  assert.equal(situacionDe(7), null);
  assert.equal(a(7, 10).avance, 50);
  for (let s = 0; s < 20; s++) assert.equal(a(7, s).estado, 'en_ruta');
});

test('un viaje con situación se detiene y después recupera lo perdido', () => {
  const situacion = situacionDe(1);
  assert.ok(situacion);
  assert.equal(a(1, 4).estado, 'en_ruta');
  const detenido = a(1, 8);
  assert.equal(detenido.estado, 'retraso');
  assert.equal(detenido.situacion.texto, situacion.texto);
  assert.equal(detenido.avance, 25);
  assert.equal(a(1, 9.9).avance, 25);
  assert.equal(a(1, 11).estado, 'en_ruta');
  assert.ok(a(1, 15).avance > 25);
});

test('hay viajes con y sin situación, y con situaciones distintas', () => {
  const textos = Array.from({ length: 7 }, (_, id) => situacionDe(id)?.texto);
  assert.ok(textos.includes(undefined));
  assert.ok(new Set(textos.filter(Boolean)).size >= 4);
});

test('el avance nunca retrocede', () => {
  for (let id = 0; id < 7; id++) {
    let anterior = 0;
    for (let s = 0; s < 20; s += 0.5) {
      const { avance } = a(id, s, { avance: anterior });
      assert.ok(avance >= anterior, `viaje ${id} en ${s} s`);
      anterior = avance;
    }
  }
});

test('un viaje en curso anterior a la simulación se da por terminado', () => {
  assert.equal(calcular({ id: 3, estado: 'en_ruta', avance: 40 }, ahora, 20).estado, 'entregado');
});
