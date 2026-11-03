import * as rastreoService from '../services/viajes/rastreoService.js';
import * as asistenteRastreoService from '../services/ia/asistenteRastreoService.js';
import * as notificacionService from '../services/notificacionService.js';

export const vistaPublica = async (req, res) => {
  res.json(await rastreoService.vistaPublica(req.params.token));
};

export const suscribirPush = async (req, res) => {
  const viaje = await rastreoService.viajeDelEnlace(req.params.token);
  res.status(201).json(await notificacionService.suscribir(req.body?.suscripcion, { viajeId: viaje.id }));
};

export const cancelarPush = async (req, res) => {
  const viaje = await rastreoService.viajeDelEnlace(req.params.token);
  res.json(await notificacionService.cancelar(req.body?.endpoint, { viajeId: viaje.id }));
};

export const preguntar = async (req, res) => {
  res.json(await asistenteRastreoService.preguntar(req.params.token, req.body?.pregunta, req.body?.historial));
};
