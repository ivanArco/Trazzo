import 'dotenv/config';
import mysql from 'mysql2/promise';

// Bases de datos en la nube (Aiven, PlanetScale…) exigen conexión cifrada: DB_SSL=true.
// Con DB_CA_CERT (el certificado CA que da el proveedor) además se verifica que el servidor sea el correcto.
// En la computadora local no se pone DB_SSL y la conexión queda como antes.
function opcionesSsl() {
  if (process.env.DB_SSL !== 'true') return undefined;
  const ca = process.env.DB_CA_CERT?.trim();
  return ca
    ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } // admite el certificado pegado en una sola línea con \n
    : { rejectUnauthorized: false };                               // cifrada, pero sin verificar el certificado
}

// Los datos de conexión viven en .env (nunca en el código)
const pool = mysql.createPool({
  ssl: opcionesSsl(),
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
