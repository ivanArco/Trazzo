import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';

// SSL para bases en la nube que lo exigen (Aiven: ssl-mode=REQUIRED). Se activa con DB_SSL=true.
// El certificado CA de la nube va en DB_CA_PATH (ruta a un archivo .pem) o en DB_CA (el texto del
// certificado; útil en Render, donde no hay archivos). La base local sigue funcionando sin SSL.
function opcionesSsl() {
  if (process.env.DB_SSL !== 'true') return undefined;
  const ca = process.env.DB_CA?.replace(/\\n/g, '\n') || (process.env.DB_CA_PATH && fs.readFileSync(process.env.DB_CA_PATH, 'utf8'));
  if (!ca) throw new Error('DB_SSL=true necesita el certificado CA en DB_CA_PATH o DB_CA (descárgalo de tu proveedor de MySQL)');
  return { ca, rejectUnauthorized: true };
}

// Los datos de conexión viven en .env (nunca en el código)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'trazzo',
  port: Number(process.env.DB_PORT) || 3306,
  ssl: opcionesSsl(),
  decimalNumbers: true, // DECIMAL (flete) llega como número y no como texto
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ejecuta varias consultas como una sola: si algo falla, se deshace todo
export const enTransaccion = async (trabajo) => {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

export default pool;
