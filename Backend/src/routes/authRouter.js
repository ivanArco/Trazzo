import { Router } from 'express';
import { login, perfil } from '../controllers/authController.js';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();

router.post('/login', login);              // POST /api/auth/login
router.get('/me', verificarToken, perfil); // GET  /api/auth/me

export default router;
