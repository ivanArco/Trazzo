import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRouter.js';
import userRoutes from './routes/userRouter.js';
import viajeRoutes from './routes/viajeRouter.js';
import flotaRoutes from './routes/flotaRouter.js';
import rutaRoutes from './routes/rutaRouter.js';
import rastreoRoutes from './routes/rastreoRouter.js';
import asistenteRoutes from './routes/asistenteRouter.js';
import chatbotRoutes from './routes/chatbotRouter.js';

// Obtener la ruta equivalente a __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. Archivos estáticos
// Subir dos niveles desde Backend/src hasta la raíz del proyecto para servir HTML, CSS, JS e imágenes
app.use(express.static(path.join(__dirname, '../../')));

// Rastreo público para clientes
app.use('/api/rastreo', rastreoRoutes);

// Configuración de CORS
const origenes = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origenes.length ? origenes : false }));
app.use(express.json());

// Definición de rutas principales de la API
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/viajes', viajeRoutes);
app.use('/api/flota', flotaRoutes);
app.use('/api/rutas', rutaRoutes);
app.use('/api/asistente', asistenteRoutes);
app.use('/api/chatbot', chatbotRoutes);

// 2. Servir el index.html en la raíz (/)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// 3. Manejador de ruta inexistente (se mantiene AL FINAL, solo para lo que no sea API ni archivos)
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejador de errores
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es JSON válido' });
  }
  if (error.status) return res.status(error.status).json({ message: error.message });

  console.error(error);
  res.status(500).json({ message: 'Error interno del servidor' });
});

export default app;