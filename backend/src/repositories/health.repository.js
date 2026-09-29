import { pool } from '../config/db.js';

/**
 * Comprueba que PostgreSQL responde con la consulta más simple posible.
 * Es la única capa que habla con la base de datos.
 *
 * @returns {Promise<void>} Se resuelve si la BD responde; lanza un error si no.
 */
export async function pingDatabase() {
  await pool.query('SELECT 1');
}
