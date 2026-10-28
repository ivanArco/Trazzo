import * as viajeService from '../services/viajeService.js';
import * as rastreoService from '../services/rastreoService.js';

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

// La dirección del frontend (con su carpeta) sirve para armar el enlace del QR; si no llega, el encabezado Origin
export const activarRastreo = async (req, res) => {
  res.json(await rastreoService.activar(Number(req.params.id), req.body?.base || req.get('origin')));
};

export const desactivarRastreo = async (req, res) => {
  res.json(await rastreoService.desactivar(Number(req.params.id)));
};

export const historial = async (req, res) => {
  if (req.query.formato === 'csv') {
    const hoy = new Date().toISOString().slice(0, 10);
    res.attachment(`trazzo-viajes-${hoy}.csv`).type('text/csv; charset=utf-8');
    return res.send(await viajeService.historialCsv(req.query, req.usuario));
  }
  res.json(await viajeService.historial(req.query, req.usuario));
};
