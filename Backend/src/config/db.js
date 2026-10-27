import 'dotenv/config';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

// Los datos de conexión viven en .env (nunca en el código)
const ssl = process.env.DB_SSL === 'required'
  ? {
      rejectUnauthorized: process.env.DB_SSL_VERIFY !== 'false',
      ...(process.env.DB_SSL_CA ? { ca: readFileSync(process.env.DB_SSL_CA) } : {})
    }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'trazzo',
  port: Number(process.env.DB_PORT) || 3306,
  ssl,
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
