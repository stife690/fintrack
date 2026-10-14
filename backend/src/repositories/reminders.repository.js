import { pool } from '../config/db.js';

/**
 * @typedef {object} ReminderSettings
 * @property {string|null} time Hora local del recordatorio en formato HH:mm; `null` si está desactivado.
 * @property {string} timezone Zona horaria IANA del usuario.
 */

/**
 * @typedef {object} ReminderCandidate
 * @property {string} id Identificador del usuario.
 * @property {string} time Hora local del recordatorio (HH:mm).
 * @property {string} timezone Zona horaria IANA del usuario.
 * @property {boolean} hasSubscription Si el usuario tiene al menos un dispositivo suscrito.
 */

const SETTINGS_COLUMNS = `to_char(reminder_time, 'HH24:MI') AS time, timezone`;

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
 * Guarda la hora y la zona horaria del recordatorio.
 * @param {string} userId
 * @param {ReminderSettings} settings
 * @returns {Promise<ReminderSettings|null>} La configuración guardada, o `null` si el usuario no existe.
 */
export async function saveReminderSettings(userId, { time, timezone }) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET reminder_time = $2::time, timezone = $3
     WHERE id = $1
     RETURNING ${SETTINGS_COLUMNS}`,
    [userId, time, timezone],
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
            to_char(u.reminder_time, 'HH24:MI') AS time,
            u.timezone,
            EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.usuario_id = u.id) AS "hasSubscription"
     FROM usuarios u
     WHERE u.reminder_time IS NOT NULL`,
  );
  return rows;
}
