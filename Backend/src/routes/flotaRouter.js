import { Router } from 'express';
import { unidades, crearUnidad, actualizarUnidad, operadores } from '../controllers/flotaController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

router.use(verificarToken, permitir('admin', 'capturista'));

router.get('/unidades', unidades);                // GET   /api/flota/unidades
router.post('/unidades', crearUnidad);            // POST  /api/flota/unidades
router.patch('/unidades/:id', actualizarUnidad);  // PATCH /api/flota/unidades/:id  (datos o estado: disponible | taller)
router.get('/operadores', operadores);            // GET   /api/flota/operadores

export default router;
