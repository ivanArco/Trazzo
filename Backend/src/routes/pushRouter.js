import { Router } from 'express';
import { verificarToken, permitir } from '../middlewares/auth.js';
import { pushDisponible, clavePublica, suscribir, cancelar } from '../services/notificacionService.js';

const router = Router();

// GET /api/push/clave → clave pública VAPID para que el navegador cree la suscripción
router.get('/clave', (req, res) => {
  res.json({ disponible: pushDisponible(), clave: clavePublica() });
});

// Personal con sesión: oficina (todos los viajes) y operador (sus viajes)
router.use(verificarToken, permitir('admin', 'capturista', 'operador'));

// POST /api/push/suscripcion  { suscripcion }   (lo que devuelve pushManager.subscribe() en el navegador)
router.post('/suscripcion', async (req, res) => {
  res.status(201).json(await suscribir(req.body?.suscripcion, { usuarioId: req.usuario.id }));
});

// DELETE /api/push/suscripcion  { endpoint }
router.delete('/suscripcion', async (req, res) => {
  res.json(await cancelar(req.body?.endpoint));
});

export default router;
