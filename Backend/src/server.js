import 'dotenv/config'; // primero: carga .env antes que el resto de módulos
import app from './app.js';
import { recuperarLecturasOcr } from './services/documentoService.js';
import { iniciarSimulador } from './services/simuladorService.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env (copia .env.example)');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  if ((process.env.ALMACEN || 'disco').toLowerCase() !== 's3' && (process.env.RENDER || process.env.RENDER_EXTERNAL_URL)) {
    console.warn('ALMACEN=disco usa almacenamiento efímero en Render; configura un disco persistente o ALMACEN=s3.');
  }
  // Reanuda las lecturas OCR que quedaron pendientes tras un reinicio del servidor.
  try {
    const lecturasOcrPendientes = await recuperarLecturasOcr();
    if (lecturasOcrPendientes) console.log(`Reanudando OCR de ${lecturasOcrPendientes} documento(s)`);
  } catch (error) {
    console.error('No se pudieron reanudar los documentos pendientes de OCR:', error);
  }
});

// Seguimiento de prueba: SIMULADOR_SEGUNDOS=0 en .env lo apaga
iniciarSimulador(Number(process.env.SIMULADOR_SEGUNDOS ?? 10));
