// db.js
// Configuración de conexión a PostgreSQL en Railway


import pkg from 'pg';
const { Pool } = pkg;


const pool = new Pool({
  user: 'postgres',
  host: 'zephyr.proxy.rlwy.net',
  database: 'railway',
  password: 'YVakmsMCghvogFFjrpHNzoJOhLlBbfZh',
  port: 59829,
  ssl: {
    rejectUnauthorized: false
  }
});


// Código de prueba de conexión

// Prueba de conexión: esto se ejecuta siempre que corras node db.js
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error de conexión:', err);
  } else {
    console.log('Conexión exitosa:', res.rows);
  }
  pool.end();
});

export default pool;

// Puedes probar la conexión ejecutando este archivo con:
// node db.js
// Y agregando este código al final:
// pool.query('SELECT NOW()', (err, res) => {
//   if (err) {
//     console.error('Error de conexión:', err);
//   } else {
//     console.log('Conexión exitosa:', res.rows);
//   }
//   pool.end();
// });
