import * as rutaService from '../services/viajes/rutaService.js';

export const estimar = async (req, res) => {
  res.json(await rutaService.estimar(req.query));
};
