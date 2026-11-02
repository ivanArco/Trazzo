import 'dotenv/config';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

// Bases de datos en la nube (Aiven, PlanetScale…) exigen conexión cifrada: DB_SSL=true.
// Con DB_CA_CERT (el certificado CA que da el proveedor) además se verifica que el servidor sea el correcto.
// En la computadora local no se pone DB_SSL y la conexión queda como antes.
function opcionesSsl() {
  if (!['true', 'required'].includes(process.env.DB_SSL)) return undefined;
  // El certificado puede venir como contenido (DB_CA_CERT, admite \n en una sola línea) o como archivo (DB_SSL_CA)
  const ca = process.env.DB_CA_CERT?.trim().replace(/\\n/g, '\n')
    || (process.env.DB_SSL_CA ? readFileSync(process.env.DB_SSL_CA) : undefined);
  // Con certificado se verifica el servidor; sin él, la conexión se cifra pero no se verifica
  const verificar = process.env.DB_SSL_VERIFY ? process.env.DB_SSL_VERIFY !== 'false' : Boolean(ca);
  return { rejectUnauthorized: verificar, ...(ca ? { ca } : {}) };
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
