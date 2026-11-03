import { rateLimit } from 'express-rate-limit';

// Límite de peticiones con la configuración común de la API.
// limitar({ limite: 10, mensaje: '...' }) → por IP y por minuto; `clave` cambia a quién se cuenta
export const limitar = ({ limite, mensaje, minutos = 1, clave, ...opciones }) => rateLimit({
  windowMs: minutos * 60 * 1000,
  limit: limite,
  ...(clave && { keyGenerator: clave }),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: mensaje },
  ...opciones
});

export const porUsuario = (req) => `usuario-${req.usuario.id}`;
