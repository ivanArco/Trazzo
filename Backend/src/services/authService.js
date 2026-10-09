import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';

export const login = async ({ correo, contraseña } = {}) => {
  if (!correo || !contraseña) throw new HttpError(400, 'Escribe tu correo y contraseña');

  const usuario = await userModel.findUserByEmail(correo.trim().toLowerCase());
  const coincide = usuario && await bcrypt.compare(contraseña, usuario.contraseña);

  // Mismo mensaje en ambos casos para no revelar qué correos existen
  if (!coincide) throw new HttpError(401, 'Correo o contraseña incorrectos');

  const { id, nombre, rol } = usuario;
  const token = jwt.sign({ id, nombre, rol }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRA || '8h'
  });

  return { token, usuario: { id, nombre, correo: usuario.correo, rol } };
};
