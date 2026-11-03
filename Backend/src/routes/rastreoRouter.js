import express, { Router } from 'express';
import cors from 'cors';
import * as rastreo from '../controllers/rastreoController.js';
import { limitar } from '../middlewares/limite.js';

const router = Router();
const leerJson = express.json({ limit: '10kb' });

// Ruta PÚBLICA (sin sesión): cualquier origen puede leerla, pero con límite de peticiones
router.use(cors({ origin: '*' }));
router.use(limitar({ limite: 30, mensaje: 'Demasiadas consultas. Espera un minuto.' }));

// Cada pregunta al asistente tiene costo en la API de IA: límites más estrictos
// por persona (IP) y por envío, para que un enlace compartido no se use sin control
const limitePorIp = limitar({ limite: 6, mensaje: 'Muchas preguntas seguidas. Espera un minuto.' });
const limitePorEnvio = limitar({
  minutos: 60,
  limite: 40,
  clave: (req) => `envio-${req.params.token}`,
  mensaje: 'Este envío alcanzó el límite de preguntas por hora. Intenta más tarde.'
});

router.get('/:token', rastreo.vistaPublica);
router.post('/:token/push', leerJson, rastreo.suscribirPush);     // { suscripcion }
router.delete('/:token/push', leerJson, rastreo.cancelarPush);    // { endpoint }
// { pregunta, historial: [{ rol: 'usuario' | 'asistente', texto }] }
router.post('/:token/pregunta', leerJson, limitePorIp, limitePorEnvio, rastreo.preguntar);

export default router;
