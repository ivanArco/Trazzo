import pool from '../config/db.js';

// Nunca se selecciona la contraseña, salvo en findUserByEmail (solo para el login)
export const getAllUsersFromDB = async () => {
  const [rows] = await pool.query('SELECT id, nombre, correo, rol FROM usuarios ORDER BY nombre');
  return rows;
};

export const findUserByEmail = async (correo) => {
  const [rows] = await pool.execute(
    'SELECT id, nombre, correo, contraseña, rol FROM usuarios WHERE correo = ?',
    [correo]
  );
  return rows[0];
};

export const createUserInDB = async (nombre, correo, contraseña, rol) => {
  const [result] = await pool.execute(
    'INSERT INTO usuarios (nombre, correo, contraseña, rol) VALUES (?, ?, ?, ?)',
    [nombre, correo, contraseña, rol]
  );
  return result.insertId;
};
