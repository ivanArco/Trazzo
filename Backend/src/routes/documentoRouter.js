// Rutas del módulo documental con límites de carga y permisos por rol.
import { Router } from 'express';
import * as documentos from '../controllers/documentoController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';
import { limitar, porUsuario } from '../middlewares/limite.js';
import { recibirImagen } from '../middlewares/recibirImagen.js';

const router = Router();
const administracion = permitir('admin');
const adminYOperador = permitir('admin', 'operador');

router.use(verificarToken);

// Cada subida o relectura cuesta una llamada al OCR: máximo 20 por minuto por usuario
const limitarLecturas = limitar({ limite: 20, clave: porUsuario, mensaje: 'Demasiados documentos seguidos. Espera un minuto.' });

// Rutas fijas (/viaje/:id) van antes de /:id para que no se confundan con un id
router.post('/', adminYOperador, limitarLecturas, recibirImagen, documentos.subir);  // multipart: viaje_id + imagen
router.get('/ocr-config', adminYOperador, documentos.ocrConfig);
router.get('/', administracion, documentos.listar);                                  // galería administrativa
router.post('/lote', administracion, limitarLecturas, documentos.lote);
router.get('/viaje/:viajeId', adminYOperador, documentos.porViaje);                 // estado visible desde el viaje propio
router.post('/:id/archivar', administracion, documentos.archivar);
router.post('/:id/restaurar', administracion, documentos.restaurar);
router.get('/:id/archivo', administracion, documentos.archivo);                      // foto privada, (?m=1 = miniatura)
router.get('/:id/bitacora', administracion, documentos.bitacora);                   // auditoría
router.get('/:id', administracion, documentos.detalle);                             // OCR y datos extraídos
router.patch('/:id', administracion, documentos.corregir);                          // corrección manual
router.patch('/:id/revision', administracion, documentos.revisar);                  // aprobar o rechazar
router.post('/:id/reprocesar', administracion, limitarLecturas, documentos.reprocesar); // repetir el OCR

export default router;