import { Router } from 'express';
import { unidades, operadores } from '../controllers/flotaController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

router.use(verificarToken, permitir('admin', 'capturista'));

router.get('/unidades', unidades);     // GET /api/flota/unidades
router.get('/operadores', operadores); // GET /api/flota/operadores

export default router;
