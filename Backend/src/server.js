import 'dotenv/config'; // primero: carga .env antes que el resto de módulos
import app from './app.js';
import { iniciarSimulador } from './services/simuladorService.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env (copia .env.example)');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Seguimiento de prueba: SIMULADOR_SEGUNDOS=0 en .env lo apaga
iniciarSimulador(Number(process.env.SIMULADOR_SEGUNDOS ?? 10));
