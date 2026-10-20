import { pool } from '../config/db.js';

/**
 * @typedef {object} CachedInsights
 * @property {Array<{ type: string, title: string, detail: string }>} insights Insights ya validados.
 * @property {Date} generatedAt Cuándo se generaron (para decidir si siguen frescos).
 */

/**
 * Insights guardados del usuario para un mes (tabla `insights`, uno por usuario y mes).
 * @param {string} userId
 * @param {string} month AAAA-MM
 * @returns {Promise<CachedInsights|null>}
 */
export async function findInsights(userId, month) {
  const { rows } = await pool.query(
    `SELECT contenido, generado_en FROM insights WHERE usuario_id = $1 AND mes = $2`,
    [userId, month],
  );
  if (!rows[0]) return null;
  return { insights: rows[0].contenido, generatedAt: new Date(rows[0].generado_en) };
}

/**
 * Guarda (o reemplaza) los insights del usuario para un mes. Solo se persiste el resultado ya
 * validado, nunca el prompt ni la respuesta cruda del modelo.
 * @param {string} userId
 * @param {string} month AAAA-MM
 * @param {Array<{ type: string, title: string, detail: string }>} insights
 * @returns {Promise<void>}
 */
export async function saveInsights(userId, month, insights) {
  await pool.query(
    `INSERT INTO insights (usuario_id, mes, contenido) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (usuario_id, mes)
     DO UPDATE SET contenido = EXCLUDED.contenido, generado_en = now()`,
    [userId, month, JSON.stringify(insights)],
  );
}

/**
 * Fecha de la transacción más antigua del usuario (sin contar las borradas).
 * @param {string} userId
 * @returns {Promise<string|null>} AAAA-MM-DD, o `null` si no tiene transacciones.
 */
export async function findFirstTransactionDate(userId) {
  const { rows } = await pool.query(
    `SELECT to_char(min(fecha), 'YYYY-MM-DD') AS first
     FROM transacciones WHERE usuario_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  return rows[0]?.first ?? null;
}
