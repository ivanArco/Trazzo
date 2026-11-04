// Respaldo del OCR cuando Claude rechaza la petición, sin salir a internet.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
delete process.env.OCR_MOTOR;

const fetchReal = globalThis.fetch;
const errorReal = console.error;
const LECTURA = { tipo: 'otro', texto: 'leido con tesseract' };
let respuesta;
let llamadasClaude = 0;
let ocr;

before(async () => {
  console.error = () => {};
  globalThis.fetch = async () => {
    llamadasClaude++;
    return new Response(JSON.stringify(respuesta.cuerpo), { status: respuesta.status, headers: { 'Content-Type': 'application/json' } });
  };
  ocr = await import('../src/services/documentos/ocrService.js');
});
after(() => {
  globalThis.fetch = fetchReal;
  console.error = errorReal;
});

const leer = () => ocr.leerDocumento(Buffer.from('imagen'), 'image/jpeg', { respaldo: async () => LECTURA });
const error = (type, message) => ({ type: 'error', error: { type, message } });

test('sin saldo, ese documento se lee con el respaldo y se sigue usando Claude', async () => {
  respuesta = { status: 400, cuerpo: error('invalid_request_error', 'credit balance too low') };
  assert.deepEqual(await leer(), LECTURA);
  assert.equal(ocr.elegirMotor(), 'claude');
});

test('con la clave rechazada se usa el respaldo y no se vuelve a intentar con Claude', async () => {
  respuesta = { status: 401, cuerpo: error('authentication_error', 'invalid x-api-key') };
  assert.deepEqual(await leer(), LECTURA);
  assert.equal(ocr.elegirMotor(), 'tesseract');
  assert.equal(ocr.informacionMotor().externo, false);

  const antes = llamadasClaude;
  assert.deepEqual(await leer(), LECTURA);
  assert.equal(llamadasClaude, antes);
});
