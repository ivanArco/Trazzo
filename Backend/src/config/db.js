import 'dotenv/config';
import mysql from 'mysql2/promise';

// Los datos de conexión viven en .env (nunca en el código)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'trazzo',
  port: Number(process.env.DB_PORT) || 3306,
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
