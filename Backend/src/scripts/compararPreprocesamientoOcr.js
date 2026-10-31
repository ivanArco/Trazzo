// Compara variantes de preprocesamiento OCR sobre documentos existentes sin modificar evidencia.
import 'dotenv/config';
import crypto from 'node:crypto';
import pool from '../config/db.js';
import * as almacen from '../services/almacenService.js';
import { compararPreprocesamientos, cerrarTrabajadorOcr } from '../services/ocrService.js';

async function main() {
  const [documentos] = await pool.query(
    "SELECT id, archivo_clave, mime, sha256 FROM documentos WHERE tipo = 'identificacion' ORDER BY id DESC LIMIT 20"
  );
  if (!documentos.length) {
    console.log('No hay fotos reales de identificaciones para comparar; no se modificó ningún documento.');
    return;
  }

  const resultados = [];
  for (const doc of documentos) {
    try {
      const imagen = await almacen.leer(doc.archivo_clave);
      const huella = crypto.createHash('sha256').update(imagen).digest('hex');
      if (huella !== doc.sha256) {
        resultados.push({ id: doc.id, estado: 'huella no coincide', antes: '—', despues: '—', mejora: '—', adoptado: 'no' });
        continue;
      }
      const metricas = await compararPreprocesamientos(imagen);
      resultados.push({
        id: doc.id,
        estado: 'comparado localmente',
        antes: `${metricas.calidadAntes}/100`,
        despues: `${metricas.calidadDespues}/100`,
        mejora: `${metricas.mejora >= 0 ? '+' : ''}${metricas.mejora}`,
        adoptado: metricas.adoptado ? 'sí' : 'no'
      });
    } catch (error) {
      resultados.push({ id: doc.id, estado: `no se pudo comparar: ${error.message}`, antes: '—', despues: '—', mejora: '—', adoptado: 'no' });
    }
  }
  console.table(resultados);
  const comparables = resultados.filter((resultado) => resultado.estado === 'comparado localmente');
  const adoptados = comparables.filter((resultado) => resultado.adoptado === 'sí').length;
  console.log(`Fotos comparadas: ${comparables.length}; variante adoptada por mejora >=5 puntos: ${adoptados}. No se guardó ni mostró texto OCR.`);
}

main()
  .catch((error) => {
    console.error(`No se pudo comparar el preprocesamiento OCR: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cerrarTrabajadorOcr();
    } finally {
      await pool.end();
    }
  });
