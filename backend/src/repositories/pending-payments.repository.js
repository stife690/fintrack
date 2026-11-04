import { pool } from '../config/db.js';

/**
 * @typedef {object} PendingPaymentRecord
 * @property {string} id UUID del pago.
 * @property {string} merchant Comercio que mandó el Atajo.
 * @property {number} amount Monto.
 * @property {string} date Fecha AAAA-MM-DD.
 * @property {string|null} card Nombre de la tarjeta en Wallet, si vino.
 * @property {'pending'|'confirmed'|'discarded'} status Estado.
 * @property {string|null} transactionId Movimiento creado al confirmarlo.
 * @property {boolean} possibleDuplicate Ya hay un gasto con el mismo monto entre un día antes y uno después.
 * @property {Date} createdAt Cuándo llegó.
 */

const STATUS = `CASE p.estado WHEN 'pendiente' THEN 'pending' WHEN 'confirmado' THEN 'confirmed'
  ELSE 'discarded' END`;

// Un pago es "posible duplicado" si el usuario ya anotó un gasto igual a mano (o por WhatsApp).
const COLUMNS = `p.id, p.comercio AS merchant, p.monto::float8 AS amount,
  to_char(p.fecha, 'YYYY-MM-DD') AS date, p.tarjeta AS card, ${STATUS} AS status,
  p.transaccion_id AS "transactionId", p.created_at AS "createdAt",
  EXISTS (
    SELECT 1 FROM transacciones t
    WHERE t.usuario_id = p.usuario_id AND t.deleted_at IS NULL AND t.tipo = 'gasto'
      AND t.monto = p.monto AND t.fecha BETWEEN p.fecha - 1 AND p.fecha + 1
      AND t.id IS DISTINCT FROM p.transaccion_id
  ) AS "possibleDuplicate"`;

/* ---------- Token del Atajo ---------- */

/**
 * Guarda el hash del token nuevo; reemplaza el anterior, que deja de servir.
 * @param {string} userId
 * @param {string} tokenHash SHA-256 en hexadecimal.
 * @returns {Promise<{ createdAt: Date, lastUsedAt: Date|null }>}
 */
export async function saveToken(userId, tokenHash) {
  const { rows } = await pool.query(
    `INSERT INTO atajo_tokens (usuario_id, token_hash) VALUES ($1, $2)
     ON CONFLICT (usuario_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now(),
       usado_at = NULL
     RETURNING created_at AS "createdAt", usado_at AS "lastUsedAt"`,
    [userId, tokenHash],
  );
  return rows[0];
}

/**
 * @param {string} userId
 * @returns {Promise<{ createdAt: Date, lastUsedAt: Date|null }|null>}
 */
export async function findToken(userId) {
  const { rows } = await pool.query(
    `SELECT created_at AS "createdAt", usado_at AS "lastUsedAt" FROM atajo_tokens
     WHERE usuario_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * @param {string} userId
 * @returns {Promise<boolean>} Si había un token.
 */
export async function deleteToken(userId) {
  const { rowCount } = await pool.query('DELETE FROM atajo_tokens WHERE usuario_id = $1', [userId]);
  return rowCount > 0;
}

/**
 * Busca de quién es el token y anota que se usó.
 * @param {string} tokenHash
 * @returns {Promise<{ userId: string, email: string, timezone: string }|null>}
 */
export async function useToken(tokenHash) {
  const { rows } = await pool.query(
    `UPDATE atajo_tokens a SET usado_at = now() FROM usuarios u
     WHERE a.token_hash = $1 AND u.id = a.usuario_id
     RETURNING u.id AS "userId", u.email, u.timezone`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

/* ---------- Pagos ---------- */

/**
 * Guarda un pago que mandó el Atajo. Si ya había uno con la misma llave no hace nada.
 * @param {{ userId: string, merchant: string, amount: number, date: string, card: string|null, key: string }} data
 * @returns {Promise<PendingPaymentRecord|undefined>} `undefined` si ya existía.
 */
export async function insertPayment(data) {
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO pagos_por_confirmar (usuario_id, comercio, monto, fecha, tarjeta, llave)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (usuario_id, llave) DO NOTHING
       RETURNING *
     )
     SELECT ${COLUMNS} FROM ins p`,
    [data.userId, data.merchant, data.amount, data.date, data.card, data.key],
  );
  return rows[0];
}

/**
 * @param {string} userId
 * @param {string} key
 * @returns {Promise<PendingPaymentRecord|null>}
 */
export async function findPaymentByKey(userId, key) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM pagos_por_confirmar p WHERE p.usuario_id = $1 AND p.llave = $2`,
    [userId, key],
  );
  return rows[0] ?? null;
}

/**
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<PendingPaymentRecord|null>}
 */
export async function findPayment(id, userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM pagos_por_confirmar p WHERE p.id = $1 AND p.usuario_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * Pagos que esperan confirmación, del más nuevo al más viejo.
 * @param {string} userId
 * @returns {Promise<PendingPaymentRecord[]>}
 */
export async function listPending(userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM pagos_por_confirmar p
     WHERE p.usuario_id = $1 AND p.estado = 'pendiente'
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows;
}

/**
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countPending(userId) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM pagos_por_confirmar
     WHERE usuario_id = $1 AND estado = 'pendiente'`,
    [userId],
  );
  return rows[0].n;
}

/**
 * Cierra un pago pendiente. Solo cambia si sigue pendiente, así dos toques no crean dos gastos.
 * @param {{ id: string, userId: string, status: 'confirmado'|'descartado', transactionId?: string|null }} data
 * @param {import('pg').PoolClient|import('pg').Pool} [client]
 * @returns {Promise<PendingPaymentRecord|undefined>} `undefined` si ya no estaba pendiente.
 */
export async function resolvePayment({ id, userId, status, transactionId = null }, client = pool) {
  const { rows } = await client.query(
    `WITH upd AS (
       UPDATE pagos_por_confirmar SET estado = $3, transaccion_id = $4, updated_at = now()
       WHERE id = $1 AND usuario_id = $2 AND estado = 'pendiente'
       RETURNING *
     )
     SELECT ${COLUMNS} FROM upd p`,
    [id, userId, status, transactionId],
  );
  return rows[0];
}
