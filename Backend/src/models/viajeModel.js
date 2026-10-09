import pool from '../config/db.js';

// Viaje con los nombres de operador, unidad y capturista ya resueltos
const SELECT_VIAJE = `
  SELECT v.id, v.folio, v.origen, v.destino, v.gps_origen, v.gps_destino, v.mercancia,
         v.peso_kg, v.num_unidades, v.flete, v.cliente, v.salida, v.distancia_km, v.duracion_min,
         v.estado, v.avance, v.eta,
         v.creado_en, v.entregado_en,
         v.operador_id, o.nombre AS operador,
         v.unidad_id, u.placas, u.marca_modelo,
         c.nombre AS capturo
  FROM viajes v
  LEFT JOIN usuarios o ON o.id = v.operador_id
  LEFT JOIN unidades u ON u.id = v.unidad_id
  LEFT JOIN usuarios c ON c.id = v.creado_por`;

// Primero lo que requiere atención: retrasos, en ruta, asignados, pendientes, entregados
const ORDEN = `ORDER BY FIELD(v.estado, 'retraso', 'en_ruta', 'asignado', 'pendiente', 'entregado', 'cancelado'), v.salida`;

export const listar = async ({ estados, operadorId } = {}) => {
  const filtros = [];
  const valores = [];

  if (estados?.length) {
    filtros.push(`v.estado IN (${estados.map(() => '?').join(', ')})`);
    valores.push(...estados);
  } else {
    // Por defecto: todo lo activo y lo entregado en los últimos 3 días
    filtros.push("(v.estado IN ('pendiente', 'asignado', 'en_ruta', 'retraso') OR (v.estado = 'entregado' AND v.entregado_en >= NOW() - INTERVAL 3 DAY))");
  }
  if (operadorId) {
    filtros.push('v.operador_id = ?');
    valores.push(operadorId);
  }

  const [rows] = await pool.query(`${SELECT_VIAJE} WHERE ${filtros.join(' AND ')} ${ORDEN} LIMIT 100`, valores);
  return rows;
};

export const buscarPorId = async (id, conexion = pool) => {
  const [rows] = await conexion.query(`${SELECT_VIAJE} WHERE v.id = ?`, [id]);
  return rows[0];
};

export const crear = async (datos, conexion = pool) => {
  const [r] = await conexion.execute(
    `INSERT INTO viajes (origen, destino, gps_origen, gps_destino, mercancia, peso_kg, num_unidades, flete, cliente, salida,
                         distancia_km, duracion_min, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.origen, datos.destino, datos.gps_origen, datos.gps_destino, datos.mercancia, datos.peso_kg,
      datos.num_unidades, datos.flete, datos.cliente, datos.salida, datos.distancia_km, datos.duracion_min, datos.creado_por]
  );
  await conexion.execute("UPDATE viajes SET folio = CONCAT('TRZ-', LPAD(id, 4, '0')) WHERE id = ?", [r.insertId]);
  return r.insertId;
};

export const actualizar = async (id, campos, conexion = pool) => {
  const columnas = Object.keys(campos);
  // Los valores { sql: '...' } se insertan como expresión (por ejemplo NOW())
  const asignaciones = columnas.map((c) => (campos[c]?.sql ? `${c} = ${campos[c].sql}` : `${c} = ?`));
  const valores = columnas.filter((c) => !campos[c]?.sql).map((c) => campos[c]);
  await conexion.query(`UPDATE viajes SET ${asignaciones.join(', ')} WHERE id = ?`, [...valores, id]);
};

export const registrarEvento = async (viajeId, tipo, descripcion, usuarioId = null, conexion = pool) => {
  await conexion.execute(
    'INSERT INTO eventos_viaje (viaje_id, tipo, descripcion, usuario_id) VALUES (?, ?, ?, ?)',
    [viajeId, tipo, descripcion, usuarioId]
  );
};

export const eventosDeViaje = async (viajeId) => {
  const [rows] = await pool.query(
    `SELECT e.id, e.tipo, e.descripcion, e.creado_en, us.nombre AS usuario
     FROM eventos_viaje e LEFT JOIN usuarios us ON us.id = e.usuario_id
     WHERE e.viaje_id = ? ORDER BY e.id DESC`,
    [viajeId]
  );
  return rows;
};

export const eventosRecientes = async ({ limite = 8, operadorId } = {}) => {
  const filtro = operadorId ? 'WHERE v.operador_id = ?' : '';
  const [rows] = await pool.query(
    `SELECT e.id, e.tipo, e.descripcion, e.creado_en, v.id AS viaje_id, v.folio
     FROM eventos_viaje e JOIN viajes v ON v.id = e.viaje_id
     ${filtro} ORDER BY e.id DESC LIMIT ?`,
    operadorId ? [operadorId, limite] : [limite]
  );
  return rows;
};

export const resumen = async () => {
  const [[viajes]] = await pool.query(`
    SELECT
      COALESCE(SUM(estado IN ('asignado', 'en_ruta', 'retraso')), 0) AS activos,
      COALESCE(SUM(estado = 'pendiente'), 0) AS por_asignar,
      COALESCE(SUM(estado = 'retraso'), 0) AS retrasos,
      COALESCE(SUM(estado = 'entregado' AND DATE(entregado_en) = CURDATE()), 0) AS entregas_hoy,
      COALESCE(SUM(CASE WHEN estado <> 'cancelado'
                        AND creado_en >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN flete END), 0) AS flete_mes
    FROM viajes`);
  const [flota] = await pool.query('SELECT estado, COUNT(*) AS total FROM unidades GROUP BY estado');

  return {
    ...viajes,
    flota: {
      disponible: 0, en_ruta: 0, taller: 0,
      ...Object.fromEntries(flota.map((f) => [f.estado, f.total]))
    }
  };
};

// Viaje activo de un operador (para no asignarle dos al mismo tiempo)
export const viajeActivoDeOperador = async (operadorId, exceptoViajeId, conexion = pool) => {
  const [rows] = await conexion.query(
    "SELECT folio FROM viajes WHERE operador_id = ? AND estado IN ('asignado', 'en_ruta', 'retraso') AND id <> ?",
    [operadorId, exceptoViajeId]
  );
  return rows[0];
};

// Viajes que el simulador hace avanzar
export const viajesEnMovimiento = async () => {
  const [rows] = await pool.query(
    "SELECT id, folio, estado, avance, unidad_id, duracion_min FROM viajes WHERE estado IN ('en_ruta', 'retraso')"
  );
  return rows;
};
