import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as panico from '../services/panicoService.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();
const operador = permitir('operador');
const admin = permitir('admin');

// La app manda la ubicación cada ~30 s; 30 por minuto por operador deja margen para reintentos
const limiteOperador = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `operador-${req.usuario.id}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Espera un minuto.' }
});

router.use(verificarToken);

// Operador (app móvil)
router.get('/mia', operador, async (req, res) => {                                   // ¿tengo una alerta activa?
  res.json({ alerta: await panico.activaDelOperador(req.usuario) });
});
router.post('/', operador, limiteOperador, async (req, res) => {                      // { lat, lon, precision_m, nota }
  const { alerta, nueva } = await panico.activar(req.body, req.usuario);
  res.status(nueva ? 201 : 200).json({ alerta, nueva });
});
router.post('/:id/ubicacion', operador, limiteOperador, async (req, res) => {         // { lat, lon, precision_m }
  res.json({ alerta: await panico.registrarUbicacion(Number(req.params.id), req.body, req.usuario) });
});

// Administrador (web)
router.get('/', admin, async (req, res) => res.json(await panico.listar(req.query)));   // ?estado=activa
router.get('/:id', admin, async (req, res) => res.json(await panico.detalle(Number(req.params.id))));
router.patch('/:id', admin, async (req, res) => {                                      // { estado, resolucion }
  res.json({ alerta: await panico.resolver(Number(req.params.id), req.body, req.usuario) });
});

export default router;
