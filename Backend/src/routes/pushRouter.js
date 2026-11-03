import { Router } from 'express';
import * as push from '../controllers/pushController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

// Clave pública VAPID para que el navegador cree la suscripción
router.get('/clave', push.clave);

// Personal con sesión: oficina (todos los viajes) y operador (sus viajes)
router.use(verificarToken, permitir('admin', 'capturista', 'operador'));

router.post('/suscripcion', push.suscribir);   // { suscripcion } (lo que devuelve pushManager.subscribe() en el navegador)
router.delete('/suscripcion', push.cancelar);  // { endpoint }

export default router;
