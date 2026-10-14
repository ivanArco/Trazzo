import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { conversar } from '../services/asistenteService.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

router.use(verificarToken, permitir('admin', 'capturista', 'operador'));

// Cada pregunta tiene costo en la API de Anthropic: máximo 15 por minuto por usuario
router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  keyGenerator: (req) => `usuario-${req.usuario.id}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muchas preguntas seguidas. Espera un minuto.' }
}));

// POST /api/asistente  { mensajes: [{ rol: 'usuario' | 'asistente', texto }] }
router.post('/', async (req, res) => {
  res.json(await conversar(req.body?.mensajes, req.usuario));
});

export default router;
