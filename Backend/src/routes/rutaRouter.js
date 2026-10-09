import { Router } from 'express';
import { estimar } from '../services/rutaService.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

router.use(verificarToken, permitir('admin', 'capturista'));

// GET /api/rutas/estimar?origen=...&destino=...&gps_origen=...&gps_destino=...
router.get('/estimar', async (req, res) => {
  res.json(await estimar(req.query));
});

export default router;
