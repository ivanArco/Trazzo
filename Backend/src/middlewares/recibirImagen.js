import multer from 'multer';
import { MAX_BYTES } from '../services/documentos/documentoService.js';
import { HttpError } from '../utils/httpError.js';

// La foto llega en memoria (campo "imagen") y se valida en el servicio
const leerImagen = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single('imagen');

export const recibirImagen = (req, res, next) => {
  leerImagen(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'La imagen pesa más de 5 MB'));
    next(new HttpError(400, 'No se pudo leer la imagen enviada'));
  });
};
