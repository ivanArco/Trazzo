import { Router } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { vistaPublica } from '../services/rastreoService.js';

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

export default router;
