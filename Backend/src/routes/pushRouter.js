import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as push from '../services/pushService.js';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();

router.use(verificarToken);

// Clave pública VAPID (la necesita el navegador para suscribirse) y si el servidor puede enviar
router.get('/clave', (req, res) => res.json(push.estado()));

// El navegador entrega su suscripción { endpoint, keys: { p256dh, auth } }
router.post('/suscripcion', async (req, res) => {
  res.status(201).json(await push.suscribir(req.body, req.usuario, req.get('user-agent')));
});
router.delete('/suscripcion', async (req, res) => res.json(await push.desuscribir(req.body, req.usuario)));

// Notificación de prueba al propio usuario (máximo 5 por minuto)
router.post('/prueba', rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `push-${req.usuario.id}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Espera un minuto antes de enviar otra prueba.' }
}), async (req, res) => res.json(await push.prueba(req.usuario)));

export default router;
