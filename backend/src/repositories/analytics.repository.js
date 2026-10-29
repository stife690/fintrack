import { pool } from '../config/db.js';

/**
 * @typedef {object} AnalyticsMovement
 * @property {number} amount Monto (siempre positivo; el signo lo da `type`).
 * @property {string} description Descripción libre (solo para agrupar gastos hormiga; nunca va a la IA).
 * @property {'ingreso'|'gasto'} type Tipo de movimiento.
 * @property {string|null} category Clave de la categoría, o `null` si está sin clasificar.
 * @property {string} date Fecha AAAA-MM-DD.
 */

/**
 * Movimientos no borrados de un usuario entre dos fechas (RN-01: solo los suyos), sin ordenar.
 * @param {string} userId
 * @param {{ from: string, to: string }} range AAAA-MM-DD, ambos incluidos.
 * @returns {Promise<AnalyticsMovement[]>}
 */
export async function listMovements(userId, { from, to }) {
  const { rows } = await pool.query(
    `SELECT t.monto::float8 AS amount, t.descripcion AS description, t.tipo AS type,
            c.key AS category, to_char(t.fecha, 'YYYY-MM-DD') AS date
     FROM transacciones t LEFT JOIN categorias c ON c.id = t.categoria_id
     WHERE t.usuario_id = $1 AND t.deleted_at IS NULL AND t.fecha BETWEEN $2 AND $3`,
    [userId, from, to],
  );
  return rows;
}
