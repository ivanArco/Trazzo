import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRouter.js';
import userRoutes from './routes/userRouter.js';
import viajeRoutes from './routes/viajeRouter.js';
import flotaRoutes from './routes/flotaRouter.js';
import rutaRoutes from './routes/rutaRouter.js';

const app = express();

// Solo los orígenes del frontend listados en CORS_ORIGIN pueden llamar a la API
const origenes = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origenes.length ? origenes : false }));
app.use(express.json());

// Definición de rutas principales
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/viajes', viajeRoutes);
app.use('/api/flota', flotaRoutes);
app.use('/api/rutas', rutaRoutes);

// Ruta inexistente
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejador de errores: los HttpError conservan su código; lo demás es 500
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es JSON válido' });
  }
  if (error.status) return res.status(error.status).json({ message: error.message });

  console.error(error);
  res.status(500).json({ message: 'Error interno del servidor' });
});

export default app;
