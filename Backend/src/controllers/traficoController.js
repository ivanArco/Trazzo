import * as traficoService from '../services/viajes/traficoService.js';

export const imagen = async (req, res) => {
  const { capa, z, x, y } = req.params;
  const png = await traficoService.tile(capa, z, x, y);
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=120' }).send(png);
};

export const estado = (req, res) => {
  res.json(traficoService.estado());
};

export const viajes = async (req, res) => {
  res.json(await traficoService.viajesActivos());
};

export const detalle = async (req, res) => {
  res.json(await traficoService.detalle(Number(req.params.id)));
};
