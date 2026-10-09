import * as flotaModel from '../models/flotaModel.js';

export const unidades = async (req, res) => {
  res.json(await flotaModel.listarUnidades());
};

export const operadores = async (req, res) => {
  res.json(await flotaModel.listarOperadores());
};
