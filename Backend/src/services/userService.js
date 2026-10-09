import bcrypt from 'bcrypt';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';

export const ROLES = ['admin', 'capturista', 'operador', 'cliente'];
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getUsers = async () => {
  return await userModel.getAllUsersFromDB();
};

export const createNewUser = async (userData = {}) => {
  const nombre = userData.nombre?.trim();
  const correo = userData.correo?.trim().toLowerCase();
  const { contraseña, rol } = userData;

  if (!nombre || !correo || !contraseña || !rol) {
    throw new HttpError(400, 'Todos los campos son obligatorios');
  }
  if (!CORREO_VALIDO.test(correo)) throw new HttpError(400, 'El correo no es válido');
  if (contraseña.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  if (!ROLES.includes(rol)) throw new HttpError(400, `Rol inválido. Usa: ${ROLES.join(', ')}`);

  const hash = await bcrypt.hash(contraseña, 10);

  try {
    const id = await userModel.createUserInDB(nombre, correo, hash, rol);
    return { id, nombre, correo, rol }; // la contraseña nunca sale de la API
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ese correo ya está registrado');
    throw error;
  }
};
