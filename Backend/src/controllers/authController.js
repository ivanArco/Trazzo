import * as authService from '../services/authService.js';

export const login = async (req, res) => {
  const sesion = await authService.login(req.body);
  res.status(200).json(sesion);
};

// Devuelve los datos del usuario dueño del token
export const perfil = (req, res) => {
  res.status(200).json(req.usuario);
};
