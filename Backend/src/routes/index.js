// Todas las rutas de la API con sesión, bajo /api. /api/rastreo es pública y se monta aparte en app.js.
import { Router } from 'express';
import authRoutes from './authRouter.js';
import userRoutes from './userRouter.js';
import viajeRoutes from './viajeRouter.js';
import flotaRoutes from './flotaRouter.js';
import rutaRoutes from './rutaRouter.js';
import asistenteRoutes from './asistenteRouter.js';
import chatbotRoutes from './chatbotRouter.js';
import traficoRoutes from './traficoRouter.js';
import pushRoutes from './pushRouter.js';
import documentoRoutes from './documentoRouter.js';
import panicoRoutes from './panicoRouter.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true }));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/viajes', viajeRoutes);
router.use('/flota', flotaRoutes);
router.use('/rutas', rutaRoutes);
router.use('/asistente', asistenteRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/trafico', traficoRoutes);
router.use('/push', pushRoutes);
router.use('/documentos', documentoRoutes); // carga, consulta y revisión de comprobantes de viaje
router.use('/panico', panicoRoutes);

export default router;
