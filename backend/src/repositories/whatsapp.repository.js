import { pool } from '../config/db.js';

/** Código de error de PostgreSQL por violar un índice único. */
const UNIQUE_VIOLATION = '23505';

/**
 * Número vinculado de un usuario.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function findPhone(userId) {
  const { rows } = await pool.query(
    'SELECT telefono AS phone FROM whatsapp_vinculos WHERE usuario_id = $1',
    [userId],
  );
  return rows[0]?.phone ?? null;
}

/**
 * Dueño de un número vinculado.
 * @param {string} phone
 * @returns {Promise<string|null>}
 */
export async function findUserIdByPhone(phone) {
  const { rows } = await pool.query(
    'SELECT usuario_id AS "userId" FROM whatsapp_vinculos WHERE telefono = $1',
    [phone],
  );
  return rows[0]?.userId ?? null;
}

/**
 * Guarda el código para vincular. Reemplaza el anterior y no toca el número ya vinculado.
 * @param {{ userId: string, codeHash: string, expiresAt: Date }} data
 * @returns {Promise<void>}
 */
export async function saveLinkCode({ userId, codeHash, expiresAt }) {
  await pool.query(
    `INSERT INTO whatsapp_vinculos (usuario_id, codigo_hash, codigo_expira)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id)
     DO UPDATE SET codigo_hash = EXCLUDED.codigo_hash, codigo_expira = EXCLUDED.codigo_expira`,
    [userId, codeHash, expiresAt],
  );
}

/**
 * Gasta un código vigente y le asigna el número a su usuario, en una sola sentencia.
 * @param {{ codeHash: string, phone: string }} data
 * @returns {Promise<'linked'|'invalid'|'taken'>} `taken` si el número es de otra cuenta.
 */
export async function confirmLink({ codeHash, phone }) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE whatsapp_vinculos
       SET telefono = $2, codigo_hash = NULL, codigo_expira = NULL
       WHERE codigo_hash = $1 AND codigo_expira > now()`,
      [codeHash, phone],
    );
    return rowCount > 0 ? 'linked' : 'invalid';
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return 'taken';
    throw err;
  }
}

/**
 * Desconecta el número del usuario.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function removeLink(userId) {
  await pool.query('DELETE FROM whatsapp_vinculos WHERE usuario_id = $1', [userId]);
}

/**
 * Reserva un mensaje para procesarlo y borra los de más de 30 días.
 * @param {{ messageId: string, userId: string }} data
 * @returns {Promise<boolean>} `false` si ya se había procesado.
 */
export async function claimMessage({ messageId, userId }) {
  const { rowCount } = await pool.query(
    `WITH viejos AS (
       DELETE FROM whatsapp_mensajes WHERE created_at < now() - interval '30 days'
     )
     INSERT INTO whatsapp_mensajes (mensaje_id, usuario_id)
     VALUES ($1, $2)
     ON CONFLICT (mensaje_id) DO NOTHING`,
    [messageId, userId],
  );
  return rowCount > 0;
}

/**
 * Mensajes de un usuario en las últimas 24 horas.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countRecentMessages(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM whatsapp_mensajes
     WHERE usuario_id = $1 AND created_at > now() - interval '1 day'`,
    [userId],
  );
  return rows[0].n;
}
