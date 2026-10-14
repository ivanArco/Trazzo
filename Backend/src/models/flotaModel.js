import pool from '../config/db.js';

// Cada unidad con el viaje que la ocupa (si hay) y cuántos viajes ha hecho
const SELECT_UNIDAD = `
  SELECT u.id, u.placas, u.marca_modelo, u.anio, u.capacidad_kg, u.poliza, u.estado,
    (SELECT v.folio FROM viajes v
      WHERE v.unidad_id = u.id AND v.estado IN ('asignado', 'en_ruta', 'retraso') LIMIT 1) AS viaje_activo,
    (SELECT v.estado FROM viajes v
      WHERE v.unidad_id = u.id AND v.estado IN ('asignado', 'en_ruta', 'retraso') LIMIT 1) AS viaje_estado,
    (SELECT COUNT(*) FROM viajes v WHERE v.unidad_id = u.id AND v.estado = 'entregado') AS viajes_entregados
  FROM unidades u`;

export const listarUnidades = async () => {
  const [rows] = await pool.query(`${SELECT_UNIDAD} ORDER BY FIELD(u.estado, 'disponible', 'en_ruta', 'taller'), u.placas`);
  return rows;
};

export const buscarUnidad = async (id) => {
  const [rows] = await pool.query(`${SELECT_UNIDAD} WHERE u.id = ?`, [id]);
  return rows[0];
};

export const crearUnidad = async ({ placas, marca_modelo, anio, capacidad_kg, poliza }) => {
  const [r] = await pool.execute(
    'INSERT INTO unidades (placas, marca_modelo, anio, capacidad_kg, poliza) VALUES (?, ?, ?, ?, ?)',
    [placas, marca_modelo, anio, capacidad_kg, poliza]
  );
  return r.insertId;
};

// Solo columnas conocidas: los nombres vienen del servicio, nunca del usuario
export const actualizarUnidad = async (id, campos) => {
  const columnas = Object.keys(campos);
  if (!columnas.length) return;
  await pool.query(
    `UPDATE unidades SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    [...columnas.map((c) => campos[c]), id]
  );
};

// FOR UPDATE bloquea la fila durante la transacción de asignación
export const unidadParaAsignar = async (id, conexion) => {
  const [rows] = await conexion.query('SELECT id, placas, capacidad_kg, estado FROM unidades WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
};

export const cambiarEstadoUnidad = async (id, estado, conexion = pool) => {
  await conexion.execute('UPDATE unidades SET estado = ? WHERE id = ?', [estado, id]);
};

// Operadores con su viaje activo (si tienen) y cuántos viajes llevan en el mes
export const listarOperadores = async () => {
  const [rows] = await pool.query(`
    SELECT u.id, u.nombre,
      (SELECT v.folio FROM viajes v
        WHERE v.operador_id = u.id AND v.estado IN ('asignado', 'en_ruta', 'retraso') LIMIT 1) AS viaje_activo,
      (SELECT COUNT(*) FROM viajes v
        WHERE v.operador_id = u.id AND v.creado_en >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS viajes_mes
    FROM usuarios u
    WHERE u.rol = 'operador'
    ORDER BY viaje_activo IS NOT NULL, u.nombre`);
  return rows;
};

export const buscarOperador = async (id, conexion = pool) => {
  const [rows] = await conexion.query("SELECT id, nombre FROM usuarios WHERE id = ? AND rol = 'operador'", [id]);
  return rows[0];
};
