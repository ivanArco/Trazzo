import pool from '../config/db.js';

// Guarda (o actualiza, si el navegador ya estaba registrado) la suscripción de un usuario
export const guardar = async ({ usuario_id, endpoint, p256dh, auth, navegador }) => {
  await pool.execute(
    `INSERT INTO suscripciones_push (usuario_id, endpoint, p256dh, auth, navegador) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), p256dh = VALUES(p256dh), auth = VALUES(auth),
                             navegador = VALUES(navegador), creada_en = NOW()`,
    [usuario_id, endpoint, p256dh, auth, navegador]
  );
};

export const eliminar = async (endpoint, usuarioId) => {
  const [r] = await pool.execute('DELETE FROM suscripciones_push WHERE endpoint = ? AND usuario_id = ?', [endpoint, usuarioId]);
  return r.affectedRows;
};

// La borra el servidor cuando el servicio push responde que ya no existe (410 o 404)
export const eliminarPorId = async (id) => {
  await pool.execute('DELETE FROM suscripciones_push WHERE id = ?', [id]);
};

export const deUsuario = async (usuarioId) => {
  const [rows] = await pool.query('SELECT id, endpoint, p256dh, auth FROM suscripciones_push WHERE usuario_id = ?', [usuarioId]);
  return rows;
};

export const deRoles = async (roles) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.endpoint, s.p256dh, s.auth FROM suscripciones_push s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE u.rol IN (${roles.map(() => '?').join(', ')})`,
    roles
  );
  return rows;
};

export const contarDeUsuario = async (usuarioId) => {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM suscripciones_push WHERE usuario_id = ?', [usuarioId]);
  return total;
};
