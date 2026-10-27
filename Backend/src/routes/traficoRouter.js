import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as trafico from '../services/traficoService.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

// Imágenes de la capa de tráfico: Leaflet las pide con <img>, que no puede mandar el token,
// así que van sin sesión. Solo entregan imágenes de TomTom; la clave se queda en el servidor.
router.get('/tiles/:capa/:z/:x/:y', rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiadas imágenes de tráfico. Espera un minuto.' }
}), async (req, res) => {
  const { capa, z, x, y } = req.params;
  const imagen = await trafico.tile(capa, z, x, y);
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=120' }).send(imagen);
});

// Por ahora solo administradores (después se abrirá a operadores)
router.use(verificarToken, permitir('admin'));

router.get('/estado', (req, res) => res.json(trafico.estado()));          // ¿hay clave? consultas usadas hoy
router.get('/viajes', async (req, res) => res.json(await trafico.viajesActivos()));
router.get('/viajes/:id', async (req, res) => res.json(await trafico.detalle(Number(req.params.id))));

export default router;
