// Diagnóstico de archivos documentales ausentes; solo archiva con opción y confirmación explícitas.
import 'dotenv/config';
import pool from '../config/db.js';
import * as almacen from '../services/almacenService.js';
import { archivar } from '../services/documentoService.js';

const argumentos = process.argv.slice(2);
const valor = (nombre) => {
  const indice = argumentos.indexOf(nombre);
  return indice < 0 ? undefined : argumentos[indice + 1];
};
const confirmarArchivo = argumentos.includes('--archivar-faltantes')
  && valor('--confirmar') === 'ARCHIVAR FALTANTES';

async function main() {
  if (argumentos.includes('--archivar-faltantes') && !confirmarArchivo) {
    throw new Error('Para archivar, agrega --confirmar "ARCHIVAR FALTANTES". No se modificó ningún registro.');
  }

  let administrador = null;
  const adminId = valor('--admin-id');
  const motivo = valor('--motivo')?.trim();
  if (confirmarArchivo) {
    if (!/^\d+$/.test(adminId || '') || !motivo) {
      throw new Error('El archivado requiere --admin-id válido y --motivo obligatorio.');
    }
    const [admins] = await pool.execute("SELECT id FROM usuarios WHERE id = ? AND rol = 'admin'", [Number(adminId)]);
    administrador = admins[0];
    if (!administrador) throw new Error('El usuario indicado no existe o no es administrador.');
  }

  const [columnas] = await pool.query('SHOW COLUMNS FROM documentos');
  const tieneArchivoLogico = columnas.some((columna) => columna.Field === 'archivado_en');
  if (confirmarArchivo && !tieneArchivoLogico) {
    throw new Error('El esquema todavía no admite archivado. Ejecuta pnpm migrar y vuelve a intentar.');
  }
  const [documentos] = await pool.query(
    `SELECT d.id, d.viaje_id, v.folio, d.tipo, d.archivo_clave, d.sha256, d.estado,
            ${tieneArchivoLogico ? 'd.archivado_en' : 'NULL AS archivado_en'}
     FROM documentos d JOIN viajes v ON v.id = d.viaje_id
     ORDER BY d.viaje_id, d.id`
  );
  const ubicacion = almacen.configuracionAlmacen();
  console.log(`Almacén: ${ubicacion.tipo}`);
  if (ubicacion.tipo === 'disco') {
    console.log(`UPLOAD_DIR definido: ${ubicacion.uploadDirDefinido ? 'sí' : 'no; se usa la ruta temporal predeterminada'}`);
    console.log(`Carpeta examinada: ${ubicacion.carpeta}`);
  } else {
    console.log(`Bucket: ${ubicacion.bucket} · endpoint: ${ubicacion.endpoint}`);
  }

  const faltantes = [];
  let encontrados = 0;
  for (const doc of documentos) {
    if (await almacen.existe(doc.archivo_clave)) {
      encontrados++;
      continue;
    }
    faltantes.push(doc);
  }

  console.log(`Registros examinados: ${documentos.length}; archivos encontrados: ${encontrados}; faltantes: ${faltantes.length}`);
  if (faltantes.length) {
    console.table(faltantes.map((doc) => ({
      id: doc.id,
      viaje: doc.folio,
      tipo: doc.tipo,
      archivo_clave: doc.archivo_clave,
      sha256: doc.sha256,
      estado: doc.estado,
      archivado: Boolean(doc.archivado_en)
    })));
  }

  const hashes = new Map();
  for (const doc of documentos.filter((item) => !item.archivado_en)) {
    const clave = `${doc.viaje_id}:${doc.sha256}`;
    hashes.set(clave, [...(hashes.get(clave) || []), doc]);
  }
  const duplicados = [...hashes.values()].filter((grupo) => grupo.length > 1);
  if (duplicados.length) {
    console.log('Coincidencias exactas SHA-256 activas (no se archivan automáticamente):');
    console.table(duplicados.flat().map((doc) => ({
      viaje: doc.folio,
      id: doc.id,
      estado: doc.estado,
      archivado: Boolean(doc.archivado_en),
      archivo_clave: doc.archivo_clave,
      sha256: doc.sha256
    })));
  }

  if (confirmarArchivo) {
    const elegibles = faltantes.filter((doc) => !doc.archivado_en && ['pendiente', 'rechazado'].includes(doc.estado));
    for (const doc of elegibles) {
      await archivar(doc.id, { motivo }, { id: administrador.id, rol: 'admin' });
    }
    console.log(`Archivados: ${elegibles.length}. Aprobados, ya archivados y otros estados se conservaron sin cambios.`);
  } else {
    console.log('Modo de solo lectura: no se modificó ningún archivo ni registro.');
  }

  if (ubicacion.tipo === 'disco' && faltantes.length) {
    console.log('Posible causa: la base comparte archivo_clave pero esta instancia solo examina su UPLOAD_DIR local; confirma la ruta y el host que realizó cada carga.');
  }
}

main()
  .catch((error) => {
    console.error(`No se pudo completar la auditoría: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
