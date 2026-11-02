import pool from '../config/db.js';

// Alerta con los nombres del operador, del viaje, de la unidad y de quien la atendió ya resueltos
const SELECT_ALERTA = `
  SELECT a.id, a.estado, a.operador_id, o.nombre AS operador, o.correo AS operador_correo,
         a.viaje_id, v.folio, v.origen, v.destino,
         a.unidad_id, u.placas, u.marca_modelo,
         a.lat, a.lon, a.precision_m, a.ubicacion_en, a.nota, a.creada_en,
         a.atendida_por, r.nombre AS atendio, a.atendida_en, a.resolucion
  FROM alertas_panico a
  JOIN usuarios o ON o.id = a.operador_id
  LEFT JOIN viajes v ON v.id = a.viaje_id
  LEFT JOIN unidades u ON u.id = a.unidad_id
  LEFT JOIN usuarios r ON r.id = a.atendida_por`;

export const buscarPorId = async (id, conexion = pool) => {
  const [rows] = await conexion.query(`${SELECT_ALERTA} WHERE a.id = ?`, [id]);
  return rows[0];
};

// Bloquea al operador mientras dura la transacción: si la app manda dos alertas al mismo tiempo,
// la segunda espera y encuentra la primera en lugar de crear otra
export const bloquearOperador = async (operadorId, conexion) => {
  await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [operadorId]);
};

export const activaDeOperador = async (operadorId, conexion = pool) => {
  const [rows] = await conexion.query(`${SELECT_ALERTA} WHERE a.operador_id = ? AND a.estado = 'activa'`, [operadorId]);
  return rows[0];
};

// Viaje que el operador lleva en este momento (para ligarlo a la alerta)
export const viajeActivoDeOperador = async (operadorId, conexion = pool) => {
  const [rows] = await conexion.query(
    `SELECT id, folio, unidad_id FROM viajes
     WHERE operador_id = ? AND estado IN ('en_ruta', 'retraso', 'asignado')
     ORDER BY FIELD(estado, 'en_ruta', 'retraso', 'asignado') LIMIT 1`,
    [operadorId]
  );
  return rows[0];
};

export const listar = async ({ estados, limite = 50 } = {}) => {
  const filtro = estados?.length ? `WHERE a.estado IN (${estados.map(() => '?').join(', ')})` : '';
  const [rows] = await pool.query(
    `${SELECT_ALERTA} ${filtro} ORDER BY a.estado = 'activa' DESC, a.creada_en DESC LIMIT ?`,
    [...(estados || []), limite]
  );
  return rows;
};

export const crear = async (datos, conexion = pool) => {
  const [r] = await conexion.execute(
    'INSERT INTO alertas_panico (operador_id, viaje_id, unidad_id, nota) VALUES (?, ?, ?, ?)',
    [datos.operador_id, datos.viaje_id, datos.unidad_id, datos.nota]
  );
  return r.insertId;
};

// Guarda el punto en el recorrido y lo deja como la última ubicación de la alerta
export const agregarUbicacion = async (alertaId, { lat, lon, precision_m }, conexion = pool) => {
  await conexion.execute(
    'INSERT INTO ubicaciones_panico (alerta_id, lat, lon, precision_m) VALUES (?, ?, ?, ?)',
    [alertaId, lat, lon, precision_m]
  );
  await conexion.execute(
    'UPDATE alertas_panico SET lat = ?, lon = ?, precision_m = ?, ubicacion_en = NOW() WHERE id = ?',
    [lat, lon, precision_m, alertaId]
  );
};

export const ubicaciones = async (alertaId, limite = 500) => {
  const [rows] = await pool.query(
    `SELECT lat, lon, precision_m, registrada_en FROM (
       SELECT lat, lon, precision_m, registrada_en, id FROM ubicaciones_panico
       WHERE alerta_id = ? ORDER BY id DESC LIMIT ?
     ) ultimas ORDER BY id`,
    [alertaId, limite]
  );
  return rows;
};

export const resolver = async (id, { estado, atendida_por, resolucion }, conexion = pool) => {
  await conexion.execute(
    'UPDATE alertas_panico SET estado = ?, atendida_por = ?, atendida_en = NOW(), resolucion = ? WHERE id = ?',
    [estado, atendida_por, resolucion, id]
  );
};
