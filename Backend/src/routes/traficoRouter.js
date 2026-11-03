import { Router } from 'express';
import * as trafico from '../controllers/traficoController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';
import { limitar } from '../middlewares/limite.js';

const router = Router();

// Imágenes de la capa de tráfico: Leaflet las pide con <img>, que no puede mandar el token,
// así que van sin sesión. Solo entregan imágenes de TomTom; la clave se queda en el servidor.
router.get('/tiles/:capa/:z/:x/:y', limitar({ limite: 600, mensaje: 'Demasiadas imágenes de tráfico. Espera un minuto.' }), trafico.imagen);

// Por ahora solo administradores (después se abrirá a operadores)
router.use(verificarToken, permitir('admin'));

router.get('/estado', trafico.estado);  // ¿hay clave? consultas usadas hoy
router.get('/viajes', trafico.viajes);
router.get('/viajes/:id', trafico.detalle);

export default router;
