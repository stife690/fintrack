import { pool } from '../config/db.js';

/** Cuántos avisos se guardan por usuario; los más viejos se borran al llegar uno nuevo. */
export const MAX_KEPT = 100;

/**
 * @typedef {object} NotificationRecord
 * @property {string} id Id del aviso.
 * @property {string} title Título (lo mismo que dice el push).
 * @property {string} body Texto del aviso.
 * @property {string|null} url Ruta de la app a la que lleva.
 * @property {boolean} read Si ya lo vio.
 * @property {Date} createdAt Cuándo llegó.
 */

const COLUMNS = `id, titulo AS title, cuerpo AS body, url, leida_at IS NOT NULL AS read,
  created_at AS "createdAt"`;

/**
 * Guarda un aviso en la bandeja del usuario y deja solo los `MAX_KEPT` más recientes.
 * @param {{ userId: string, title: string, body: string, url: string|null }} data Ya recortado.
 * @returns {Promise<void>}
 */
export async function insertNotification({ userId, title, body, url }) {
  await pool.query(
    'INSERT INTO notificaciones (usuario_id, titulo, cuerpo, url) VALUES ($1, $2, $3, $4)',
    [userId, title, body, url],
  );
  await pool.query(
    `DELETE FROM notificaciones WHERE id IN (
       SELECT id FROM notificaciones WHERE usuario_id = $1
       ORDER BY created_at DESC, id OFFSET $2)`,
    [userId, MAX_KEPT],
  );
}

/**
 * Los avisos más recientes del usuario y cuántos no ha leído.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<{ items: NotificationRecord[], unread: number }>}
 */
export async function listNotifications(userId, limit) {
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT ${COLUMNS} FROM notificaciones WHERE usuario_id = $1
       ORDER BY created_at DESC, id LIMIT $2`,
      [userId, limit],
    ),
    pool.query(
      'SELECT count(*)::int AS n FROM notificaciones WHERE usuario_id = $1 AND leida_at IS NULL',
      [userId],
    ),
  ]);
  return { items: list.rows, unread: count.rows[0].n };
}

/**
 * Marca como leídos todos los avisos del usuario.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function markAllRead(userId) {
  await pool.query(
    'UPDATE notificaciones SET leida_at = now() WHERE usuario_id = $1 AND leida_at IS NULL',
    [userId],
  );
}

/**
 * Deja la marca de que un presupuesto ya avisó este nivel. Solo la primera vez devuelve `true`:
 * así el aviso no se repite con cada gasto (la tabla tiene un índice único por presupuesto y nivel).
 * @param {string} budgetId
 * @param {'warning_80'|'exceeded_100'} level
 * @returns {Promise<boolean>}
 */
export async function claimBudgetAlert(budgetId, level) {
  const { rowCount } = await pool.query(
    `INSERT INTO alertas (presupuesto_id, nivel, notificado_push) VALUES ($1, $2, true)
     ON CONFLICT (presupuesto_id, nivel) DO NOTHING`,
    [budgetId, level],
  );
  return rowCount === 1;
}
