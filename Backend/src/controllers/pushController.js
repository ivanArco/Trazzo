import * as notificacionService from '../services/notificacionService.js';

export const clave = (req, res) => {
  res.json({ disponible: notificacionService.pushDisponible(), clave: notificacionService.clavePublica() });
};

export const suscribir = async (req, res) => {
  res.status(201).json(await notificacionService.suscribir(req.body?.suscripcion, { usuarioId: req.usuario.id }));
};

export const cancelar = async (req, res) => {
  res.json(await notificacionService.cancelar(req.body?.endpoint));
};
