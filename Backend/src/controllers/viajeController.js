import * as viajeService from '../services/viajeService.js';

export const listar = async (req, res) => {
  res.json(await viajeService.listar(req.query, req.usuario));
};

export const detalle = async (req, res) => {
  res.json(await viajeService.detalle(Number(req.params.id), req.usuario));
};

export const resumen = async (req, res) => {
  res.json(await viajeService.resumen());
};

export const eventos = async (req, res) => {
  res.json(await viajeService.eventosRecientes(req.usuario));
};

export const crear = async (req, res) => {
  res.status(201).json(await viajeService.crear(req.body, req.usuario));
};

export const asignar = async (req, res) => {
  res.json(await viajeService.asignar(Number(req.params.id), req.body, req.usuario));
};

export const cambiarEstado = async (req, res) => {
  res.json(await viajeService.cambiarEstado(Number(req.params.id), req.body, req.usuario));
};
