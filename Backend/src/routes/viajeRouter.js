import { Router } from 'express';
import * as viajes from '../controllers/viajeController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();
const oficina = permitir('admin', 'capturista');

router.use(verificarToken);

// /resumen y /eventos van antes de /:id para que no se confundan con un id
router.get('/resumen', viajes.resumen);                                         // KPIs del tablero
router.get('/eventos', viajes.eventos);                                         // alertas recientes
router.get('/', viajes.listar);                                                 // ?estado=en_ruta,retraso
router.get('/:id', viajes.detalle);                                             // viaje + historial
router.post('/', oficina, viajes.crear);                                        // registrar ruta
router.patch('/:id/asignar', oficina, viajes.asignar);                          // { operador_id, unidad_id }
router.patch('/:id/estado', permitir('admin', 'capturista', 'operador'), viajes.cambiarEstado); // { estado, nota }

export default router;
