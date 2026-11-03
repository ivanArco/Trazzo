import pool from '../config/db.js';

// La tabla se crea sola la primera vez (también está en database/schema.sql)
let tablaLista = null;
function asegurarTabla() {
  tablaLista ??= pool.query(`CREATE TABLE IF NOT EXISTS suscripciones_push (
    id INT NOT NULL AUTO_INCREMENT,
    endpoint VARCHAR(600) CHARACTER SET ascii NOT NULL,
    p256dh VARCHAR(200) NOT NULL,
    auth VARCHAR(100) NOT NULL,
    usuario_id INT NULL,
    viaje_id INT NOT NULL DEFAULT 0,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY endpoint_viaje (endpoint, viaje_id),
    KEY viaje (viaje_id),
    CONSTRAINT fk_push_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`).catch((error) => {
    tablaLista = null;
    throw error;
  });
  return tablaLista;
}

export const guardar = async ({ endpoint, p256dh, auth, usuarioId, viajeId }) => {
  await asegurarTabla();
  await pool.query(
    `INSERT INTO suscripciones_push (endpoint, p256dh, auth, usuario_id, viaje_id) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth), usuario_id = VALUES(usuario_id)`,
    [endpoint, p256dh, auth, usuarioId, viajeId]
  );
};

export const eliminar = async (endpoint, viajeId) => {
  await asegurarTabla();
  await pool.query('DELETE FROM suscripciones_push WHERE endpoint = ? AND viaje_id = ?', [endpoint, viajeId]);
};

export const eliminarDeViaje = async (viajeId) => {
  await asegurarTabla();
  await pool.query('DELETE FROM suscripciones_push WHERE viaje_id = ?', [viajeId]);
};

export const eliminarPorId = async (id) => {
  await pool.query('DELETE FROM suscripciones_push WHERE id = ?', [id]);
};

// Clientes que siguen ese envío + personal indicado
export const deViajeYUsuarios = async (viajeId, usuarioIds) => {
  await asegurarTabla();
  const [rows] = await pool.query(
    `SELECT id, endpoint, p256dh, auth, usuario_id, viaje_id FROM suscripciones_push
      WHERE viaje_id = ? OR (viaje_id = 0 AND usuario_id IN (?))`,
    [viajeId, usuarioIds.length ? usuarioIds : [-1]]
  );
  return rows;
};

export const deRoles = async (roles) => {
  await asegurarTabla();
  const [rows] = await pool.query(
    `SELECT s.id, s.endpoint, s.p256dh, s.auth FROM suscripciones_push s
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.viaje_id = 0 AND u.rol IN (?)`,
    [roles]
  );
  return rows;
};
