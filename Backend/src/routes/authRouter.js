import { Router } from 'express';
import { login, perfil } from '../controllers/authController.js';
import { verificarToken } from '../middlewares/auth.js';
import { limitar } from '../middlewares/limite.js';

const router = Router();

// Máximo 10 intentos de acceso cada 15 minutos por IP (frena a quien intente adivinar contraseñas)
const limiteLogin = limitar({
  minutos: 15,
  limite: 10,
  skipSuccessfulRequests: true,
  mensaje: 'Demasiados intentos de acceso. Espera 15 minutos.'
});

router.post('/login', limiteLogin, login);  // POST /api/auth/login
router.get('/me', verificarToken, perfil);  // GET  /api/auth/me

export default router;
