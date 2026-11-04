import { pool } from '../config/db.js';

/**
 * @typedef {object} DebtRecord
 * @property {string} id UUID de la cuenta.
 * @property {'receivable'|'payable'} kind `receivable`: me deben; `payable`: debo.
 * @property {string} person A quién se le debe o quién debe.
 * @property {number} amount Monto.
 * @property {string|null} dueDate Fecha límite AAAA-MM-DD.
 * @property {string|null} note Nota libre.
 * @property {Date|null} settledAt Cuándo se saldó.
 * @property {string|null} transactionId Movimiento creado al saldarla.
 * @property {Date} createdAt Cuándo se creó.
 * @property {Date} updatedAt Último cambio.
 */

/** `kind` de la API → `tipo` en la base. */
export const KIND_TO_DB = { receivable: 'por_cobrar', payable: 'por_pagar' };

const COLUMNS = `id, CASE tipo WHEN 'por_cobrar' THEN 'receivable' ELSE 'payable' END AS kind,
  persona AS person, monto::float8 AS amount, to_char(fecha_limite, 'YYYY-MM-DD') AS "dueDate",
  nota AS note, saldada_at AS "settledAt", transaccion_id AS "transactionId",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Campo editable → columna. */
const UPDATABLE = {
  person: 'persona',
  amount: 'monto',
  dueDate: 'fecha_limite',
  note: 'nota',
};

/**
 * Inserta una cuenta.
 * @param {{ userId: string, kind: 'receivable'|'payable', person: string, amount: number, dueDate?: string|null, note?: string|null }} data
 * @returns {Promise<DebtRecord>}
 */
export async function insertDebt(data) {
  const { rows } = await pool.query(
    `INSERT INTO cuentas_personales (usuario_id, tipo, persona, monto, fecha_limite, nota)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [
      data.userId,
      KIND_TO_DB[data.kind],
      data.person,
      data.amount,
      data.dueDate ?? null,
      data.note ?? null,
    ],
  );
  return rows[0];
}

/**
 * Cuentas del usuario: primero las pendientes (por fecha límite, las sin fecha al final) y luego
 * las saldadas, de la más reciente a la más vieja.
 * @param {string} userId
 * @returns {Promise<DebtRecord[]>}
 */
export async function listDebts(userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM cuentas_personales WHERE usuario_id = $1
     ORDER BY saldada_at IS NOT NULL, saldada_at DESC, fecha_limite ASC NULLS LAST, created_at DESC`,
    [userId],
  );
  return rows;
}

/**
 * Una cuenta del usuario (RN-01: nunca la de otro).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<DebtRecord|undefined>}
 */
export async function findDebt(id, userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM cuentas_personales WHERE id = $1 AND usuario_id = $2`,
    [id, userId],
  );
  return rows[0];
}

/**
 * Edita una cuenta pendiente. Si cambia la fecha límite, se vuelve a poder avisar.
 * @param {string} id
 * @param {string} userId
 * @param {Partial<Pick<DebtRecord, 'person'|'amount'|'dueDate'|'note'>>} changes
 * @returns {Promise<DebtRecord|undefined>} `undefined` si no existe o ya está saldada.
 */
export async function updateDebt(id, userId, changes) {
  const sets = [];
  const values = [id, userId];
  for (const [field, column] of Object.entries(UPDATABLE)) {
    if (changes[field] === undefined) continue;
    values.push(changes[field]);
    sets.push(`${column} = $${values.length}`);
  }
  if (changes.dueDate !== undefined) sets.push('recordatorio_enviado = false');
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE cuentas_personales SET ${sets.join(', ')}
     WHERE id = $1 AND usuario_id = $2 AND saldada_at IS NULL RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0];
}

/**
 * Borra la cuenta (no borra el movimiento que se haya creado al saldarla).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function deleteDebt(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM cuentas_personales WHERE id = $1 AND usuario_id = $2',
    [id, userId],
  );
  return rowCount === 1;
}

/**
 * Marca la cuenta como saldada si sigue pendiente. Con `client` va dentro de la transacción SQL
 * que también crea el movimiento.
 * @param {{ id: string, userId: string, transactionId: string|null }} data
 * @param {import('pg').Pool|import('pg').PoolClient} [client]
 * @returns {Promise<DebtRecord|undefined>} `undefined` si otra petición ya la saldó.
 */
export async function markSettled({ id, userId, transactionId }, client = pool) {
  const { rows } = await client.query(
    `UPDATE cuentas_personales SET saldada_at = now(), transaccion_id = $3, updated_at = now()
     WHERE id = $1 AND usuario_id = $2 AND saldada_at IS NULL RETURNING ${COLUMNS}`,
    [id, userId, transactionId],
  );
  return rows[0];
}

/**
 * Cuentas pendientes que vencen mañana en la hora local de su dueño y aún no se avisaron, con la
 * hora a la que se avisa (la primera del recordatorio diario, o 09:00).
 * @returns {Promise<{ id: string, userId: string, timezone: string, time: string, kind: 'receivable'|'payable', person: string, amount: number }[]>}
 */
export async function listDebtsDueTomorrow() {
  const { rows } = await pool.query(
    `SELECT c.id, c.usuario_id AS "userId", u.timezone,
            COALESCE(to_char((SELECT min(t) FROM unnest(u.reminder_times) AS t), 'HH24:MI'), '09:00') AS time,
            CASE c.tipo WHEN 'por_cobrar' THEN 'receivable' ELSE 'payable' END AS kind,
            c.persona AS person, c.monto::float8 AS amount
     FROM cuentas_personales c JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.saldada_at IS NULL AND NOT c.recordatorio_enviado
       AND c.fecha_limite = (now() AT TIME ZONE u.timezone)::date + 1`,
  );
  return rows;
}

/**
 * Deja constancia de que ya se avisó.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function markReminded(id) {
  await pool.query('UPDATE cuentas_personales SET recordatorio_enviado = true WHERE id = $1', [id]);
}
