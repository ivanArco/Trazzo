// Rutas del módulo documental con límites de carga y permisos por rol.
import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import * as documentos from '../controllers/documentoController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';
import { MAX_BYTES } from '../services/documentoService.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
const administracion = permitir('admin');
const adminYOperador = permitir('admin', 'operador');

router.use(verificarToken);

// Cada subida o relectura cuesta una llamada al OCR: máximo 20 por minuto por usuario
const limitarLecturas = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `usuario-${req.usuario.id}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados documentos seguidos. Espera un minuto.' }
});

// La foto llega en memoria (campo "imagen") y se valida en el servicio
const leerImagen = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single('imagen');

const recibirImagen = (req, res, next) => {
  leerImagen(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'La imagen pesa más de 5 MB'));
    next(new HttpError(400, 'No se pudo leer la imagen enviada'));
  });
};

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