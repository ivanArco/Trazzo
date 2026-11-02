// Consultas persistentes del módulo de documentos y su bitácora de auditoría.
import pool from '../config/db.js';

// Columnas ligeras para listas y galería (sin el texto OCR completo)
const COLUMNAS_LISTA = `d.id, d.viaje_id, v.folio, d.tipo, d.numero_guia, d.coincide_viaje, d.confianza,
  d.ocr_estado, d.ocr_error, d.calidad_ocr, d.estado, d.nota_revision, d.archivado_en, d.motivo_archivo,
  d.mime, d.tamano, d.creado_en, d.revisado_en,
  d.subido_por, s.nombre AS subio, r.nombre AS reviso`;

const DESDE = `FROM documentos d
  JOIN viajes v ON v.id = d.viaje_id
  JOIN usuarios s ON s.id = d.subido_por
  LEFT JOIN usuarios r ON r.id = d.revisado_por`;

const normalizarCoincidencia = (doc) => doc && doc.coincide_viaje !== null
  ? { ...doc, coincide_viaje: Boolean(doc.coincide_viaje) }
  : doc;

export const asegurarEstadoOcr = async () => {
  const [columnas] = await pool.query("SHOW COLUMNS FROM documentos LIKE 'ocr_estado'");
  if (columnas.length) return false;

  try {
    await pool.query(
      "ALTER TABLE documentos ADD COLUMN ocr_estado ENUM('procesando', 'completado', 'error') NOT NULL DEFAULT 'completado' AFTER coincide_viaje"
    );
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    return false;
  }

  await pool.query(
    "UPDATE documentos SET ocr_estado = IF(texto_ocr IS NULL OR texto_ocr = '', 'error', 'completado')"
  );
  return true;
};

// Documento completo (incluye texto OCR, datos extraídos y la clave interna del archivo)
export const buscarPorId = async (id, conexion = pool, bloquear = false) => {
  const [rows] = await conexion.query(
    `SELECT d.*, v.folio, v.operador_id, s.nombre AS subio, r.nombre AS reviso ${DESDE} WHERE d.id = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [id]
  );
  return normalizarCoincidencia(rows[0]);
};

export const crear = async (d, conexion = pool) => {
  const [r] = await conexion.execute(
    `INSERT INTO documentos (viaje_id, subido_por, tipo, numero_guia, coincide_viaje, ocr_estado, ocr_error, calidad_ocr, texto_ocr, datos_json, confianza,
                             archivo_clave, mime, tamano, sha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.viaje_id, d.subido_por, d.tipo, d.numero_guia ?? null, d.coincide_viaje ?? null, d.ocr_estado ?? 'completado',
      d.ocr_error ?? null, d.calidad_ocr ?? null, d.texto_ocr ?? null,
      d.datos_json ? JSON.stringify(d.datos_json) : null, d.confianza ?? null, d.archivo_clave, d.mime, d.tamano, d.sha256]
  );
  return r.insertId;
};

export const buscarDuplicado = async (viajeId, huella, conexion = pool) => {
  const [rows] = await conexion.query(
    'SELECT id FROM documentos WHERE viaje_id = ? AND sha256 = ? AND archivado_en IS NULL LIMIT 1 FOR UPDATE',
    [viajeId, huella]
  );
  return rows[0];
};

export const bloquearViaje = async (viajeId, conexion = pool) => {
  await conexion.query('SELECT id FROM viajes WHERE id = ? FOR UPDATE', [viajeId]);
};

// Guarda (o vuelve a guardar) lo que leyó el OCR
export const guardarLectura = async (id, l, conexion = pool) => {
  await conexion.execute(
    `UPDATE documentos
     SET tipo = ?, numero_guia = ?, coincide_viaje = ?, ocr_estado = 'completado', ocr_error = NULL,
         calidad_ocr = ?, texto_ocr = ?, datos_json = ?, confianza = ?
     WHERE id = ?`,
    [l.tipo, l.numero_guia ?? null, l.coincide_viaje ?? null, l.calidad_ocr ?? null, l.texto_ocr ?? null,
      l.datos_json ? JSON.stringify(l.datos_json) : null, l.confianza ?? null, id]
  );
};

export const actualizarEstadoOcr = async (id, estado, conexion = pool) => {
  await conexion.execute('UPDATE documentos SET ocr_estado = ?, ocr_error = NULL WHERE id = ?', [estado, id]);
};

export const registrarErrorOcr = async (id, mensaje, conexion = pool) => {
  await conexion.execute('UPDATE documentos SET ocr_estado = ?, ocr_error = ? WHERE id = ?', ['error', mensaje, id]);
};

export const pendientesOcr = async () => {
  const [rows] = await pool.query(
    `SELECT d.id, d.viaje_id, d.subido_por, d.archivo_clave, d.mime, d.sha256, v.folio
     FROM documentos d JOIN viajes v ON v.id = d.viaje_id
     WHERE d.ocr_estado = 'procesando'`
  );
  return rows;
};

export const listar = async ({ estado, tipo, viajeId, texto, archivados = false, limite, desplazamiento }) => {
  const filtros = [archivados ? 'd.archivado_en IS NOT NULL' : 'd.archivado_en IS NULL'];
  const valores = [];
  if (estado) { filtros.push('d.estado = ?'); valores.push(estado); }
  if (tipo) { filtros.push('d.tipo = ?'); valores.push(tipo); }
  if (viajeId) { filtros.push('d.viaje_id = ?'); valores.push(viajeId); }
  if (texto) {
    filtros.push("CONCAT_WS(' ', v.folio, d.numero_guia, d.texto_ocr) LIKE ?");
    valores.push(`%${texto}%`);
  }
  const donde = `WHERE ${filtros.join(' AND ')}`;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${DESDE} ${donde}`, valores);
  const [rows] = await pool.query(
    `SELECT ${COLUMNAS_LISTA} ${DESDE} ${donde}
     ORDER BY FIELD(d.estado, 'pendiente', 'rechazado', 'aprobado'), d.creado_en DESC, d.id DESC
     LIMIT ? OFFSET ?`,
    [...valores, limite, desplazamiento]
  );
  return { total, documentos: rows.map(normalizarCoincidencia) };
};

export const porViaje = async (viajeId) => {
  const [rows] = await pool.query(
    `SELECT ${COLUMNAS_LISTA} ${DESDE} WHERE d.viaje_id = ? AND d.archivado_en IS NULL ORDER BY d.id DESC`,
    [viajeId]
  );
  return rows.map(normalizarCoincidencia);
};

export const conteoPorEstado = async () => {
  const [rows] = await pool.query(
    'SELECT estado, COUNT(*) AS total FROM documentos WHERE archivado_en IS NULL GROUP BY estado'
  );
  const [[{ archivado }]] = await pool.query(
    'SELECT COUNT(*) AS archivado FROM documentos WHERE archivado_en IS NOT NULL'
  );
  return { pendiente: 0, aprobado: 0, rechazado: 0, ...Object.fromEntries(rows.map((r) => [r.estado, r.total])), archivado };
};

export const vistoEnUltimos = async (documentoId, usuarioId, minutos = 30, conexion = pool) => {
  const [rows] = await conexion.query(
    `SELECT id FROM documentos_bitacora
     WHERE documento_id = ? AND usuario_id = ? AND accion = 'visto'
       AND creado_en >= NOW() - INTERVAL ? MINUTE
     LIMIT 1`,
    [documentoId, usuarioId, minutos]
  );
  return Boolean(rows[0]);
};

export const archivar = async (id, usuarioId, motivo, conexion = pool) => {
  const [resultado] = await conexion.execute(
    `UPDATE documentos
     SET archivado_en = NOW(), archivado_por = ?, motivo_archivo = ?
     WHERE id = ? AND archivado_en IS NULL AND estado IN ('pendiente', 'rechazado')`,
    [usuarioId, motivo, id]
  );
  return resultado.affectedRows;
};

export const restaurar = async (id, conexion = pool) => {
  const [resultado] = await conexion.execute(
    `UPDATE documentos SET archivado_en = NULL, archivado_por = NULL, motivo_archivo = NULL
     WHERE id = ? AND archivado_en IS NOT NULL AND estado IN ('pendiente', 'rechazado')`,
    [id]
  );
  return resultado.affectedRows;
};

export const bloquearDocumento = async (id, conexion = pool) => {
  const [rows] = await conexion.query('SELECT viaje_id FROM documentos WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
};

export const listarFaltantes = async (conexion = pool) => {
  const [rows] = await conexion.query(
    `SELECT d.id, d.viaje_id, v.folio, d.tipo, d.archivo_clave, d.sha256, d.estado, d.archivado_en
     FROM documentos d JOIN viajes v ON v.id = d.viaje_id
     ORDER BY d.viaje_id, d.id`
  );
  return rows;
};

export const revisar = async (id, { estado, usuarioId, nota }, conexion = pool) => {
  const [resultado] = await conexion.execute(
    "UPDATE documentos SET estado = ?, revisado_por = ?, revisado_en = NOW(), nota_revision = ? WHERE id = ? AND estado = 'pendiente'",
    [estado, usuarioId, nota ?? null, id]
  );
  return resultado.affectedRows;
};

export const corregir = async (id, datos, conexion = pool) => {
  const [resultado] = await conexion.execute(
    `UPDATE documentos
     SET tipo = ?, numero_guia = ?, coincide_viaje = ?, texto_ocr = ?, datos_json = ?, confianza = NULL
     WHERE id = ? AND estado = 'pendiente'`,
    [datos.tipo, datos.numero_guia, datos.coincide_viaje, datos.texto_ocr,
      JSON.stringify({ fecha: datos.fecha, receptor: datos.receptor, monto: datos.monto }), id]
  );
  return resultado.affectedRows;
};

export const registrarBitacora = async (documentoId, usuarioId, accion, nota = null, conexion = pool) => {
  await conexion.execute(
    'INSERT INTO documentos_bitacora (documento_id, usuario_id, accion, nota) VALUES (?, ?, ?, ?)',
    [documentoId, usuarioId ?? null, accion, nota]
  );
};

export const bitacora = async (documentoId) => {
  const [rows] = await pool.query(
    `SELECT b.id, b.accion, b.nota, b.creado_en, u.nombre AS usuario
     FROM documentos_bitacora b LEFT JOIN usuarios u ON u.id = b.usuario_id
     WHERE b.documento_id = ? ORDER BY b.id DESC`,
    [documentoId]
  );
  return rows;
};