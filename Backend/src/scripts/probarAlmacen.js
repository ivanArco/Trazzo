// Prueba de escritura, lectura y eliminación controladas para el almacén documental configurado.
import 'dotenv/config';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as almacen from '../services/almacenService.js';

const clave = `${crypto.randomUUID()}.png`;
const contenido = Buffer.from('Trazzo storage smoke test');
let intentoGuardar = false;

try {
  intentoGuardar = true;
  await almacen.guardar(clave, contenido, 'image/png');
  const recuperado = await almacen.leer(clave);
  assert.deepEqual(recuperado, contenido, 'El contenido recuperado debe ser idéntico');
  await almacen.eliminar(clave);
  intentoGuardar = false;
  console.log(`Almacén ${process.env.ALMACEN || 'disco'}: guardar, leer y borrar funcionaron.`);
} catch (error) {
  process.exitCode = 1;
  console.error(`No se pudo probar el almacén (${process.env.ALMACEN || 'disco'}): ${error.message}`);
  console.error('Revisa UPLOAD_DIR y sus permisos para disco. Para s3, confirma S3_BUCKET, S3_ENDPOINT y las credenciales; el bucket debe ser privado.');
} finally {
  if (intentoGuardar) {
    try {
      await almacen.eliminar(clave);
    } catch (error) {
      console.error(`No se pudo borrar el archivo temporal ${clave}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
