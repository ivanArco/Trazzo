import { Router } from 'express';
import { estimar } from '../controllers/rutaController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

router.use(verificarToken, permitir('admin', 'capturista'));

router.get('/estimar', estimar);  // ?origen=...&destino=...&gps_origen=...&gps_destino=...

export default router;
