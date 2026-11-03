// Contrato de la API: cada ruta sigue existiendo y solo responde a los roles correctos.
// No necesita base de datos: los permisos se revisan antes de consultarla. Se ejecuta con: pnpm test
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'secreto-de-prueba';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1'; // puerto cerrado: ninguna prueba toca una base real

const TODOS = ['admin', 'capturista', 'operador', 'cliente'];
const OFICINA = ['admin', 'capturista'];
const PERSONAL = ['admin', 'capturista', 'operador'];

// [método, ruta, roles con acceso]
const RUTAS_PROTEGIDAS = [
  ['GET', '/api/auth/me', TODOS],
  ['GET', '/api/users', ['admin']],
  ['POST', '/api/users', ['admin']],
  ['GET', '/api/viajes/resumen', TODOS],
  ['GET', '/api/viajes/eventos', TODOS],
  ['GET', '/api/viajes/historial', TODOS],
  ['GET', '/api/viajes/mapa', PERSONAL],
  ['GET', '/api/viajes', TODOS],
  ['GET', '/api/viajes/1', TODOS],
  ['POST', '/api/viajes', OFICINA],
  ['PATCH', '/api/viajes/1/asignar', OFICINA],
  ['POST', '/api/viajes/1/rastreo', OFICINA],
  ['DELETE', '/api/viajes/1/rastreo', OFICINA],
  ['PATCH', '/api/viajes/1/estado', PERSONAL],
  ['PUT', '/api/viajes/1/ubicacion', ['operador']],
  ['DELETE', '/api/viajes/1/ubicacion', ['operador']],
  ['GET', '/api/flota/unidades', OFICINA],
  ['POST', '/api/flota/unidades', OFICINA],
  ['PATCH', '/api/flota/unidades/1', OFICINA],
  ['GET', '/api/flota/operadores', OFICINA],
  ['GET', '/api/rutas/estimar', OFICINA],
  ['POST', '/api/asistente', PERSONAL],
  ['POST', '/api/chatbot', TODOS],
  ['GET', '/api/trafico/estado', ['admin']],
  ['GET', '/api/trafico/viajes', ['admin']],
  ['GET', '/api/trafico/viajes/1', ['admin']],
  ['POST', '/api/push/suscripcion', PERSONAL],
  ['DELETE', '/api/push/suscripcion', PERSONAL],
  ['POST', '/api/documentos', ['admin', 'operador']],
  ['GET', '/api/documentos/ocr-config', ['admin', 'operador']],
  ['GET', '/api/documentos', ['admin']],
  ['POST', '/api/documentos/lote', ['admin']],
  ['GET', '/api/documentos/viaje/1', ['admin', 'operador']],
  ['POST', '/api/documentos/1/archivar', ['admin']],
  ['POST', '/api/documentos/1/restaurar', ['admin']],
  ['GET', '/api/documentos/1/archivo', ['admin']],
  ['GET', '/api/documentos/1/bitacora', ['admin']],
  ['GET', '/api/documentos/1', ['admin']],
  ['PATCH', '/api/documentos/1', ['admin']],
  ['PATCH', '/api/documentos/1/revision', ['admin']],
  ['POST', '/api/documentos/1/reprocesar', ['admin']],
  ['GET', '/api/panico/mia', ['operador']],
  ['POST', '/api/panico', ['operador']],
  ['POST', '/api/panico/1/ubicacion', ['operador']],
  ['GET', '/api/panico', ['admin']],
  ['GET', '/api/panico/1', ['admin']],
  ['PATCH', '/api/panico/1', ['admin']]
];

let servidor;
let base;
let cerrarPool;

before(async () => {
  const { default: app } = await import('../src/app.js');
  const { default: pool } = await import('../src/config/db.js');
  cerrarPool = () => pool.end();
  await new Promise((listo) => { servidor = app.listen(0, '127.0.0.1', listo); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  servidor.closeAllConnections();
  await new Promise((listo) => { servidor.close(listo); });
  await cerrarPool();
});

const pedir = (metodo, ruta, { rol, cuerpo } = {}) => fetch(base + ruta, {
  method: metodo,
  headers: {
    'Content-Type': 'application/json',
    ...(rol && { Authorization: `Bearer ${jwt.sign({ id: 1, nombre: 'Prueba', rol }, process.env.JWT_SECRET)}` })
  },
  body: cuerpo ?? (metodo === 'GET' ? undefined : '{}')
});

for (const [metodo, ruta, roles] of RUTAS_PROTEGIDAS) {
  test(`${metodo} ${ruta}`, async () => {
    assert.equal((await pedir(metodo, ruta)).status, 401, 'sin sesión');

    for (const rol of TODOS) {
      const respuesta = await pedir(metodo, ruta, { rol });
      if (roles.includes(rol)) {
        assert.notEqual(respuesta.status, 403, `${rol} debe tener acceso`);
        const { message } = await respuesta.json().catch(() => ({}));
        assert.notEqual(message, 'Ruta no encontrada', 'la ruta debe existir');
      } else {
        assert.equal(respuesta.status, 403, `${rol} no debe tener acceso`);
      }
    }
  });
}

test('rutas públicas', async () => {
  assert.equal((await pedir('GET', '/api/health')).status, 200);

  const clave = await pedir('GET', '/api/push/clave');
  assert.equal(clave.status, 200);
  assert.ok('disponible' in await clave.json());

  const rastreo = await pedir('GET', '/api/rastreo/token-invalido');
  assert.equal(rastreo.status, 404);
  assert.equal(rastreo.headers.get('access-control-allow-origin'), '*', 'el rastreo se puede leer desde cualquier origen');
});

test('errores comunes', async () => {
  const noExiste = await pedir('GET', '/api/no-existe');
  assert.equal(noExiste.status, 404);
  assert.deepEqual(await noExiste.json(), { message: 'Ruta no encontrada' });

  const jsonRoto = await pedir('POST', '/api/auth/login', { cuerpo: '{roto' });
  assert.equal(jsonRoto.status, 400);
  assert.deepEqual(await jsonRoto.json(), { message: 'El cuerpo de la petición no es JSON válido' });

  assert.equal((await pedir('GET', '/Backend/.env')).status, 404, 'el código del backend no se publica');
  assert.equal((await pedir('GET', '/backend/package.json')).status, 404);
});
