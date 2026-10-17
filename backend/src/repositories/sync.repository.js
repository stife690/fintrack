import { pool } from '../config/db.js';
import { COLUMNS, JOIN } from './transactions.repository.js';

/** @typedef {import('./transactions.repository.js').TransactionRecord} TransactionRecord */

/**
 * Hora actual según PostgreSQL. Es la referencia de `syncedAt`: así coincide con los
 * `updated_at` que pone la base de datos, aunque el reloj del servidor web se desfase.
 * @returns {Promise<Date>}
 */
export async function getServerTime() {
  const { rows } = await pool.query('SELECT now() AS now');
  return rows[0].now;
}
/**
 * Busca una transacción del usuario por su id del servidor, incluso si está borrada
 * (para resolver conflictos de sincronización). RN-01: nunca la de otro usuario.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<TransactionRecord|null>}
 */
export async function findForSync(id, userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM transacciones t ${JOIN} WHERE t.id = $1 AND t.usuario_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * Busca la transacción que un dispositivo creó offline con ese `localId`, incluso si
 * después se borró. Sirve para no duplicarla si el mismo lote se reenvía.
 * @param {string} userId
 * @param {string} localId
 * @returns {Promise<TransactionRecord|null>}
 */
export async function findByLocalId(userId, localId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM transacciones t ${JOIN} WHERE t.usuario_id = $1 AND t.local_id = $2`,
    [userId, localId],
  );
  return rows[0] ?? null;
}
/**
 * Inserta una transacción creada offline guardando su `localId`. Si ese `localId` ya
 * existe para el usuario, no inserta nada (índice único parcial) y devuelve `null`.
 * @param {{ userId: string, localId: string, amount: number, description: string, type: 'ingreso'|'gasto', date: string, category: string|null, source: 'manual'|'ia'|'sin_clasificar' }} data
 * @returns {Promise<TransactionRecord|null>}
 */
export async function insertFromDevice(data) {
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO transacciones
         (usuario_id, categoria_id, monto, descripcion, tipo, fecha, origen, local_id)
       VALUES ($1, (SELECT id FROM categorias WHERE key = $2), $3, $4, $5, $6, $7, $8)
       ON CONFLICT (usuario_id, local_id) WHERE local_id IS NOT NULL DO NOTHING
       RETURNING *
     )
     SELECT ${COLUMNS} FROM ins t ${JOIN}`,
    [
      data.userId,
      data.category,
      data.amount,
      data.description,
      data.type,
      data.date,
      data.source,
      data.localId,
    ],
  );
  return rows[0] ?? null;
}
/**
 * Transacciones del usuario modificadas después de `since` (incluidas las borradas), sin las
 * de `excludeIds`. Con `since` nulo (primera sincronización) devuelve todas las no borradas.
 * @param {string} userId
 * @param {Date|string|null} since
 * @param {string[]} excludeIds Ids ya informados en este lote.
 * @returns {Promise<TransactionRecord[]>}
 */
export async function listChangedSince(userId, since, excludeIds) {
  const params = [userId, excludeIds];
  let changed = 't.deleted_at IS NULL';
  if (since) {
    params.push(since);
    changed = 't.updated_at > $3';
  }
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM transacciones t ${JOIN}
     WHERE t.usuario_id = $1 AND NOT (t.id = ANY($2::uuid[])) AND ${changed}
     ORDER BY t.updated_at`,
    params,
  );
  return rows;
}