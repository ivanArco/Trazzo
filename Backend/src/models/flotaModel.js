import pool from '../config/db.js';

export const listarUnidades = async () => {
  const [rows] = await pool.query(
    `SELECT id, placas, marca_modelo, anio, capacidad_kg, poliza, estado
     FROM unidades ORDER BY FIELD(estado, 'disponible', 'en_ruta', 'taller'), placas`
  );
  return rows;
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
