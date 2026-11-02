// Almacén de archivos de los documentos digitalizados.
// Dos formas de guardar, según ALMACEN en Backend/.env:
//   disco (por defecto) → carpeta UPLOAD_DIR, FUERA del proyecto (nunca dentro de la carpeta que sirve express.static)
//   s3                  → bucket PRIVADO compatible con S3 (AWS S3, Cloudflare R2, Backblaze B2…)
// El resto de la aplicación solo usa guardar / leer / eliminar: cambiar de disco a nube no toca nada más.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HttpError } from '../utils/httpError.js';

const CLAVE_VALIDA = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
const tipoAlmacen = () => {
  const tipo = (process.env.ALMACEN || 'disco').toLowerCase();
  if (!['disco', 's3'].includes(tipo)) throw new HttpError(503, 'ALMACEN debe ser disco o s3');
  return tipo;
};
const usaS3 = () => tipoAlmacen() === 's3';

const validarClave = (clave) => {
  if (!CLAVE_VALIDA.test(clave)) throw new HttpError(400, 'Clave de archivo no válida');
};

/* ---------- Disco ---------- */
const carpeta = () => {
  return path.resolve(process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'trazzo-documentos'));
};

export function configuracionAlmacen() {
  const tipo = tipoAlmacen();
  return tipo === 's3'
    ? { tipo, bucket: process.env.S3_BUCKET || '(sin configurar)', endpoint: process.env.S3_ENDPOINT || 'AWS' }
    : { tipo, carpeta: carpeta(), uploadDirDefinido: Boolean(process.env.UPLOAD_DIR?.trim()) };
}

/* ---------- S3 / R2 ---------- */
let s3 = null;

async function sdk() {
  const modulo = await import('@aws-sdk/client-s3');
  if (!s3) {
    const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
    if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new HttpError(503, 'El almacén en la nube no está configurado: revisa las variables S3_* en Backend/.env.');
    }
    s3 = new modulo.S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,       // R2 y B2 lo necesitan; AWS no
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }
    });
  }
  return { modulo, cliente: s3 };
}

/* ---------- API pública del almacén ---------- */
export async function guardar(clave, buffer, mime) {
  validarClave(clave);
  if (usaS3()) {
    const { modulo, cliente } = await sdk();
    await cliente.send(new modulo.PutObjectCommand({
      Bucket: process.env.S3_BUCKET, Key: clave, Body: buffer, ContentType: mime
    }));
    return;
  }
  const dir = carpeta();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, clave), buffer, { flag: 'wx' }); // 'wx': nunca sobrescribe un archivo
}

export async function leer(clave) {
  validarClave(clave);
  if (usaS3()) {
    const { modulo, cliente } = await sdk();
    try {
      const r = await cliente.send(new modulo.GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: clave }));
      return Buffer.from(await r.Body.transformToByteArray());
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        throw new HttpError(404, 'El archivo del documento no se encuentra en el almacén');
      }
      throw error;
    }
  }
  try {
    return await fs.readFile(path.join(carpeta(), clave));
  } catch (error) {
    if (error.code === 'ENOENT') throw new HttpError(404, 'El archivo del documento no se encuentra en el almacén');
    throw error;
  }
}

export async function existe(clave) {
  validarClave(clave);
  if (usaS3()) {
    const { modulo, cliente } = await sdk();
    try {
      await cliente.send(new modulo.HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: clave }));
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }
  try {
    await fs.access(path.join(carpeta(), clave));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function eliminar(clave) {
  validarClave(clave);
  if (usaS3()) {
    const { modulo, cliente } = await sdk();
    await cliente.send(new modulo.DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: clave }));
    return;
  }
  try {
    await fs.unlink(path.join(carpeta(), clave));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}