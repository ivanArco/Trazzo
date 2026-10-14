import { Router } from 'express';
import { login, perfil } from '../controllers/authController.js';
import { rateLimit } from 'express-rate-limit';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Máximo 10 intentos de acceso cada 15 minutos por IP (frena a quien intente adivinar contraseñas)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Demasiados intentos de acceso. Espera 15 minutos.' }
});

router.post('/login', limiteLogin, login);              // POST /api/auth/login
router.get('/me', verificarToken, perfil); // GET  /api/auth/me

export default router;
