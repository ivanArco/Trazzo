// Viajes simulados según su ETA y situaciones. No necesita base de datos.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';

const HORA = 3_600_000;
const ahora = Date.now();
let calcular;
let situacionDe;

// Viaje de 2 h iniciado hace `horas`, a velocidad real
const a = (id, horas, datos = {}) => calcular({
  id, estado: 'en_ruta', avance: 1, salida_ms: ahora - 5 * HORA, inicio_ms: ahora - horas * HORA,
  eta_ms: ahora + (2 - horas) * HORA, duracion_min: 120, ...datos
}, ahora, 1);

before(async () => {
  ({ calcularProgreso: calcular, situacionDe } = await import('../src/services/viajes/simuladorService.js'));
});

test('un viaje asignado espera su hora de salida', () => {
  assert.equal(calcular({ id: 7, estado: 'asignado', avance: 0, salida_ms: ahora + 20 * HORA, duracion_min: 180 }, ahora, 1), null);
});

test('un viaje asignado inicia al llegar su salida y termina según su duración', () => {
  const p = calcular({ id: 7, estado: 'asignado', avance: 0, salida_ms: ahora - 0.5 * HORA, duracion_min: 180 }, ahora, 1);
  assert.equal(p.iniciar, true);
  assert.equal(p.avance, 16);
  assert.equal(p.eta, ahora + 2.5 * HORA);
});

test('el avance sigue el tiempo entre el inicio y la ETA', () => {
  assert.equal(situacionDe(7), null);
  assert.equal(a(7, 0.5).avance, 25);
  assert.equal(a(7, 1).avance, 50);
  assert.equal(a(7, 1).eta, ahora + HORA);
  assert.equal(a(7, 2).estado, 'entregado');
});

test('iniciado a mano antes de su salida, avanza desde el inicio real', () => {
  const p = a(7, 1, { salida_ms: ahora + 20 * HORA });
  assert.equal(p.avance, 50);
  assert.equal(p.eta, ahora + HORA);
});

test('respeta una ETA más lejana, por ejemplo tras un retraso', () => {
  const p = a(7, 1, { eta_ms: ahora + 3 * HORA });
  assert.equal(p.avance, 25);
  assert.equal(p.eta, ahora + 3 * HORA);
});

test('un viaje con situación se detiene y después recupera lo perdido', () => {
  const situacion = situacionDe(1);
  assert.ok(situacion);
  assert.equal(a(1, 0.4).estado, 'en_ruta');
  const detenido = a(1, 0.8);
  assert.equal(detenido.estado, 'retraso');
  assert.equal(detenido.situacion.texto, situacion.texto);
  assert.equal(detenido.avance, 25);
  assert.equal(a(1, 1.1).estado, 'en_ruta');
  assert.ok(a(1, 1.5).avance > 25);
});

test('el avance nunca retrocede y siempre termina', () => {
  for (let id = 0; id < 7; id++) {
    let anterior = 0;
    for (let h = 0; h < 2; h += 0.05) {
      const { avance } = a(id, h, { avance: anterior });
      assert.ok(avance >= anterior, `viaje ${id} en ${h} h`);
      anterior = avance;
    }
    assert.equal(a(id, 2).avance, 100);
  }
});

test('la velocidad acorta el viaje simulado', () => {
  const p = calcular({
    id: 7, estado: 'en_ruta', avance: 1, salida_ms: ahora - HORA, inicio_ms: ahora - 60_000, eta_ms: ahora + 2 * HORA, duracion_min: 120
  }, ahora, 60);
  assert.equal(p.avance, 50);
  assert.equal(p.eta, ahora + 60_000);
});
