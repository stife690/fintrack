import { pool } from '../config/db.js';

/**
 * @typedef {object} PushSubscriptionRecord
 * @property {string} endpoint URL única que el navegador asigna a la suscripción.
 * @property {{ p256dh: string, auth: string }} keys Llaves de cifrado de la suscripción.
 */

/**
 * Guarda la suscripción de un navegador. El `endpoint` es único: si ya existía
 * (p. ej. otra cuenta inició sesión en el mismo navegador) pasa a ser del usuario actual.
 * @param {{ userId: string, endpoint: string, keys: { p256dh: string, auth: string } }} data
 * @returns {Promise<void>}
 */
export async function upsertSubscription({ userId, endpoint, keys }) {
  await pool.query(
    `INSERT INTO push_subscriptions (usuario_id, endpoint, keys)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, keys = EXCLUDED.keys`,
    [userId, endpoint, JSON.stringify(keys)],
  );
}

/**
 * Elimina la suscripción de un usuario.
 * @param {{ userId: string, endpoint: string }} data
 * @returns {Promise<boolean>} `true` si existía y era del usuario (RN-01).
 */
export async function deleteSubscription({ userId, endpoint }) {
  const { rowCount } = await pool.query(
    'DELETE FROM push_subscriptions WHERE usuario_id = $1 AND endpoint = $2',
    [userId, endpoint],
  );
  return rowCount > 0;
}

/**
 * Elimina una suscripción por su endpoint (la usa el envío cuando el navegador la dio de baja).
 * @param {string} endpoint
 * @returns {Promise<void>}
 */
export async function deleteSubscriptionByEndpoint(endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

/**
 * Lista las suscripciones de un usuario (puede tener varios dispositivos).
 * @param {string} userId
 * @returns {Promise<PushSubscriptionRecord[]>}
 */
export async function listSubscriptionsByUser(userId) {
  const { rows } = await pool.query(
    'SELECT endpoint, keys FROM push_subscriptions WHERE usuario_id = $1',
    [userId],
  );
  return rows;
}
