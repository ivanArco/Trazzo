// Avance simulado de un viaje según su hora de inicio. No necesita base de datos.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';

const HORA = 3_600_000;
const ahora = Date.now();
let calcular;

before(async () => {
  ({ calcularProgresoProgramado: calcular } = await import('../src/services/viajes/simuladorService.js'));
});

test('un viaje asignado espera su hora de salida', () => {
  assert.equal(calcular({ estado: 'asignado', salida_ms: ahora + 20 * HORA, duracion_min: 180, avance: 0 }, ahora), null);
});

test('un viaje asignado inicia al llegar su hora de salida', () => {
  const p = calcular({ estado: 'asignado', salida_ms: ahora - 0.5 * HORA, eta_ms: ahora + 2.5 * HORA, duracion_min: 180, avance: 0 }, ahora);
  assert.equal(p.iniciar, true);
  assert.equal(p.avance, 16);
});

test('iniciado a mano antes de su salida, avanza desde el inicio real', () => {
  const p = calcular({
    estado: 'en_ruta', salida_ms: ahora + 20 * HORA, inicio_ms: ahora - 1.5 * HORA, eta_ms: ahora + 1.5 * HORA, duracion_min: 180, avance: 1
  }, ahora);
  assert.equal(p.avance, 50);
  assert.equal(p.eta, ahora + 1.5 * HORA);
});

test('recupera un viaje cuya llegada ya se había movido a su salida programada', () => {
  const p = calcular({
    estado: 'en_ruta', salida_ms: ahora + 20 * HORA, inicio_ms: ahora - 1.5 * HORA, eta_ms: ahora + 23 * HORA, duracion_min: 180, avance: 1
  }, ahora);
  assert.equal(p.avance, 50);
  assert.equal(p.eta, ahora + 1.5 * HORA);
});

test('iniciado a mano llega y se entrega aunque su salida programada no haya pasado', () => {
  const p = calcular({
    estado: 'en_ruta', salida_ms: ahora + 20 * HORA, inicio_ms: ahora - 4 * HORA, eta_ms: ahora - HORA, duracion_min: 180, avance: 90
  }, ahora);
  assert.equal(p.entregado, true);
  assert.equal(p.avance, 100);
});

test('un viaje que salió a su hora no cambia', () => {
  const p = calcular({
    estado: 'en_ruta', salida_ms: ahora - HORA, inicio_ms: ahora - HORA, eta_ms: ahora + HORA, duracion_min: 120, avance: 10
  }, ahora);
  assert.equal(p.avance, 50);
  assert.equal(p.eta, ahora + HORA);
});
