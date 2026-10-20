import { pool } from '../config/db.js';

/**
 * @typedef {object} ReminderSettings
 * @property {string[]} times Horas locales del recordatorio (HH:mm), ordenadas; vacío si está desactivado.
 * @property {string} timezone Zona horaria IANA del usuario.
 */

/**
 * @typedef {object} ReminderCandidate
 * @property {string} id Identificador del usuario.
 * @property {string[]} times Horas locales del recordatorio (HH:mm).
 * @property {string} timezone Zona horaria IANA del usuario.
 * @property {boolean} hasSubscription Si el usuario tiene al menos un dispositivo suscrito.
 */

const SETTINGS_COLUMNS = `ARRAY(
  SELECT to_char(t, 'HH24:MI') FROM unnest(reminder_times) AS t ORDER BY t
) AS times, timezone`;

/**
 * Lee la configuración del recordatorio de un usuario.
 * @param {string} userId
 * @returns {Promise<ReminderSettings|null>} `null` si el usuario no existe.
 */
export async function findReminderSettings(userId) {
  const { rows } = await pool.query(`SELECT ${SETTINGS_COLUMNS} FROM usuarios WHERE id = $1`, [
    userId,
  ]);
  return rows[0] ?? null;
}

/**
 * Guarda las horas y la zona horaria del recordatorio.
 * @param {string} userId
 * @param {ReminderSettings} settings
 * @returns {Promise<ReminderSettings|null>} La configuración guardada, o `null` si el usuario no existe.
 */
export async function saveReminderSettings(userId, { times, timezone }) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET reminder_times = $2::time[], timezone = $3
     WHERE id = $1
     RETURNING ${SETTINGS_COLUMNS}`,
    [userId, times, timezone],
  );
  return rows[0] ?? null;
}

/**
 * Lista a los usuarios que tienen el recordatorio activado.
 * @returns {Promise<ReminderCandidate[]>}
 */
export async function listReminderCandidates() {
  const { rows } = await pool.query(
    `SELECT u.id,
            ARRAY(SELECT to_char(t, 'HH24:MI') FROM unnest(u.reminder_times) AS t ORDER BY t) AS times,
            u.timezone,
            EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.usuario_id = u.id) AS "hasSubscription"
     FROM usuarios u
     WHERE cardinality(u.reminder_times) > 0`,
  );
  return rows;
}
