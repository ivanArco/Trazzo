import * as flotaModel from '../models/flotaModel.js';
import * as flotaService from '../services/flotaService.js';

export const unidades = async (req, res) => {
  res.json(await flotaService.listar());
};

export const crearUnidad = async (req, res) => {
  res.status(201).json(await flotaService.crear(req.body));
};

export const actualizarUnidad = async (req, res) => {
  res.json(await flotaService.actualizar(Number(req.params.id), req.body));
};

export const operadores = async (req, res) => {
  res.json(await flotaModel.listarOperadores());
};
