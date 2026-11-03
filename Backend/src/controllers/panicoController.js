import * as panicoService from '../services/panicoService.js';

export const miAlerta = async (req, res) => {
  res.json({ alerta: await panicoService.activaDelOperador(req.usuario) });
};

export const activar = async (req, res) => {
  const { alerta, nueva } = await panicoService.activar(req.body, req.usuario);
  res.status(nueva ? 201 : 200).json({ alerta, nueva });
};

export const registrarUbicacion = async (req, res) => {
  res.json({ alerta: await panicoService.registrarUbicacion(Number(req.params.id), req.body, req.usuario) });
};

export const listar = async (req, res) => {
  res.json(await panicoService.listar(req.query));
};

export const detalle = async (req, res) => {
  res.json(await panicoService.detalle(Number(req.params.id)));
};

export const resolver = async (req, res) => {
  res.json({ alerta: await panicoService.resolver(Number(req.params.id), req.body, req.usuario) });
};
