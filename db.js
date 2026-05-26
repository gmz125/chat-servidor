import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool(process.env.MYSQL_URL); // Creamos el pool directamente con la URL pública de Railway

try {
  const connection = await pool.getConnection();
  console.log('¡Conexión exitosa a la base de datos MySQL en Railway!');
  connection.release();
} catch (error) {
  console.error('Error al conectar a la base de datos:', error.message);
}

export default pool;