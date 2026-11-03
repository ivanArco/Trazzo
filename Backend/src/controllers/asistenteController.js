import { conversar } from '../services/ia/asistenteService.js';

export const preguntar = async (req, res) => {
  res.json(await conversar(req.body?.mensajes, req.usuario));
};
