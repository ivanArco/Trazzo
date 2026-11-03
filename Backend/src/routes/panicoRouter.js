import { Router } from 'express';
import * as panico from '../controllers/panicoController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';
import { limitar, porUsuario } from '../middlewares/limite.js';

const router = Router();
const operador = permitir('operador');
const admin = permitir('admin');

// La app manda la ubicación cada ~30 s; 30 por minuto por operador deja margen para reintentos
const limiteOperador = limitar({ limite: 30, clave: porUsuario, mensaje: 'Demasiadas solicitudes. Espera un minuto.' });

router.use(verificarToken);

// Operador (app móvil)
router.get('/mia', operador, panico.miAlerta);                                 // ¿tengo una alerta activa?
router.post('/', operador, limiteOperador, panico.activar);                    // { lat, lon, precision_m, nota }
router.post('/:id/ubicacion', operador, limiteOperador, panico.registrarUbicacion); // { lat, lon, precision_m }

// Administrador (web)
router.get('/', admin, panico.listar);                                         // ?estado=activa
router.get('/:id', admin, panico.detalle);
router.patch('/:id', admin, panico.resolver);                                  // { estado, resolucion }

export default router;
