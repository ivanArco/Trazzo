import express, { Router } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { vistaPublica } from '../services/rastreoService.js';
import { preguntar } from '../services/asistenteRastreoService.js';
import { suscribir, cancelar } from '../services/notificacionService.js';
import * as viajeModel from '../models/viajeModel.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// Ruta PÚBLICA (sin sesión): cualquier origen puede leerla, pero con límite de peticiones
router.use(cors({ origin: '*' }));
router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiadas consultas. Espera un minuto.' }
}));

// GET /api/rastreo/:token
router.get('/:token', async (req, res) => {
  res.json(await vistaPublica(req.params.token));
});

// Cada pregunta al asistente tiene costo en la API de Anthropic: límites más estrictos
// por persona (IP) y por envío, para que un enlace compartido no se use sin control
const limitePorIp = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muchas preguntas seguidas. Espera un minuto.' }
});
const limitePorEnvio = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => `envio-${req.params.token}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Este envío alcanzó el límite de preguntas por hora. Intenta más tarde.' }
});

// Notificaciones del cliente para este envío: el enlace debe seguir activo (vistaPublica valida token y caducidad)
async function viajeDelEnlace(token) {
  await vistaPublica(token);
  const viaje = await viajeModel.buscarPorToken(token);
  if (!viaje) throw new HttpError(404, 'Este enlace de rastreo no existe o fue desactivado');
  return viaje;
}

// POST /api/rastreo/:token/push  { suscripcion }
router.post('/:token/push', express.json({ limit: '10kb' }), async (req, res) => {
  const viaje = await viajeDelEnlace(req.params.token);
  res.status(201).json(await suscribir(req.body?.suscripcion, { viajeId: viaje.id }));
});

// DELETE /api/rastreo/:token/push  { endpoint }
router.delete('/:token/push', express.json({ limit: '10kb' }), async (req, res) => {
  const viaje = await viajeDelEnlace(req.params.token);
  res.json(await cancelar(req.body?.endpoint, { viajeId: viaje.id }));
});

// POST /api/rastreo/:token/pregunta  { pregunta, historial: [{ rol: 'usuario' | 'asistente', texto }] }
router.post('/:token/pregunta', express.json({ limit: '10kb' }), limitePorIp, limitePorEnvio, async (req, res) => {
  res.json(await preguntar(req.params.token, req.body?.pregunta, req.body?.historial));
});

export default router;
