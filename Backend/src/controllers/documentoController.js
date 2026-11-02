// Controladores HTTP para carga, consulta, lectura OCR y revisión de documentos.
import * as documentoService from '../services/documentoService.js';
import { informacionMotor } from '../services/ocrService.js';

export const subir = async (req, res) => {
  res.status(202).json(await documentoService.subir(req.file, req.body, req.usuario));
};

export const listar = async (req, res) => {
  res.json(await documentoService.listar(req.query, req.usuario));
};

export const porViaje = async (req, res) => {
  res.json(await documentoService.porViaje(req.params.viajeId, req.usuario));
};

export const detalle = async (req, res) => {
  res.json(await documentoService.detalle(req.params.id, req.usuario));
};

// ?m=1 (miniatura de la galería) no queda en la bitácora; abrir el documento sí
export const archivo = async (req, res) => {
  const { buffer, mime } = await documentoService.archivo(req.params.id, req.usuario, { auditar: req.query.m !== '1' });
  res.set({
    'Content-Type': mime,
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store'
  });
  res.send(buffer);
};

export const bitacora = async (req, res) => {
  res.json(await documentoService.bitacora(req.params.id, req.usuario));
};

export const revisar = async (req, res) => {
  res.json(await documentoService.revisar(req.params.id, req.body, req.usuario));
};

export const corregir = async (req, res) => {
  res.json(await documentoService.corregir(req.params.id, req.body, req.usuario));
};

export const reprocesar = async (req, res) => {
  res.json(await documentoService.reprocesar(req.params.id, req.usuario));
};

export const archivar = async (req, res) => {
  res.json(await documentoService.archivar(req.params.id, req.body, req.usuario));
};

export const restaurar = async (req, res) => {
  res.json(await documentoService.restaurar(req.params.id, req.usuario));
};

export const lote = async (req, res) => {
  res.json(await documentoService.lote(req.body, req.usuario));
};

export const ocrConfig = async (req, res) => {
  res.set('Cache-Control', 'no-store').json(informacionMotor());
};