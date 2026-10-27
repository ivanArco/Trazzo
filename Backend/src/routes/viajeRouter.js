import { Router } from 'express';
import * as viajes from '../controllers/viajeController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();
const oficina = permitir('admin', 'capturista');

router.use(verificarToken);

// /resumen, /eventos e /historial van antes de /:id para que no se confundan con un id
router.get('/resumen', viajes.resumen);                                         // KPIs del tablero
router.get('/eventos', viajes.eventos);                                         // alertas recientes
router.get('/historial', viajes.historial);                                     // todos: ?q=&estado=&desde=&hasta=&pagina= (&formato=csv)
router.get('/mapa', permitir('admin', 'capturista', 'operador'), viajes.mapa);   // unidades activas con trazo de ruta
router.get('/', viajes.listar);                                                 // ?estado=en_ruta,retraso
router.get('/:id', viajes.detalle);                                             // viaje + historial
router.post('/', oficina, viajes.crear);                                        // registrar ruta
router.patch('/:id/asignar', oficina, viajes.asignar);                          // { operador_id, unidad_id }
router.post('/:id/rastreo', oficina, viajes.activarRastreo);                     // enlace + QR para el cliente
router.delete('/:id/rastreo', oficina, viajes.desactivarRastreo);                // desactivar el enlace
router.patch('/:id/estado', permitir('admin', 'capturista', 'operador'), viajes.cambiarEstado); // { estado, nota }
router.put('/:id/ubicacion', permitir('operador'), viajes.actualizarUbicacion);  // GPS del teléfono del operador asignado
router.delete('/:id/ubicacion', permitir('operador'), viajes.detenerUbicacion);  // borrar última posición compartida

export default router;
