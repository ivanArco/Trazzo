import { Router } from 'express';
import { preguntar } from '../controllers/asistenteController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';
import { limitar, porUsuario } from '../middlewares/limite.js';

const router = Router();

router.use(verificarToken, permitir('admin', 'capturista', 'operador'));

// Cada pregunta tiene costo en la API de IA: máximo 15 por minuto por usuario
router.use(limitar({ limite: 15, clave: porUsuario, mensaje: 'Muchas preguntas seguidas. Espera un minuto.' }));

router.post('/', preguntar);  // { mensajes: [{ rol: 'usuario' | 'asistente', texto }] }

export default router;
