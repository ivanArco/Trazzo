import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import rutasApi from './routes/index.js';
import rastreoRoutes from './routes/rastreoRouter.js';
import { rutaNoEncontrada, manejarErrores } from './middlewares/errores.js';

// El frontend está en la raíz del proyecto, dos niveles arriba de Backend/src
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

const app = express();

// 1. Archivos estáticos (HTML, CSS, JS e imágenes), sin publicar el código del backend
app.use((req, res, next) => {
  if (/^\/backend(?:\/|$)/i.test(req.path)) return res.sendStatus(404);
  next();
});
app.use(express.static(RAIZ));

// 2. Rastreo público para clientes: va antes de CORS porque acepta cualquier origen
app.use('/api/rastreo', rastreoRoutes);

// 3. API con los orígenes permitidos
const origenes = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origenes.length ? origenes : false }));
app.use(express.json());
app.use('/api', rutasApi);

// 4. La aplicación web en la raíz (/)
app.get('/', (req, res) => {
  res.sendFile(path.join(RAIZ, 'index.html'));
});

// 5. Al final: lo que no coincidió con nada y los errores
app.use(rutaNoEncontrada);
app.use(manejarErrores);

export default app;
