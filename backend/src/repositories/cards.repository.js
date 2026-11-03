import { pool } from '../config/db.js';

/**
 * @typedef {object} CardRecord
 * @property {string} id UUID de la tarjeta.
 * @property {string} userId UUID del dueño.
 * @property {string} name Nombre con el que el usuario la reconoce.
 * @property {'visa'|'mastercard'|'amex'|'otra'} network Franquicia.
 * @property {string} tier Nivel de la tarjeta.
 * @property {string} last4 Últimos 4 dígitos (nunca el número completo).
 * @property {number} limit Cupo total.
 * @property {number} debtBase Deuda al crearla o ajustarla.
 * @property {Date} baseAt Desde cuándo cuentan cargos y pagos sobre `debtBase`.
 * @property {number} paymentDay Día del mes del pago.
 * @property {number|null} cutoffDay Día del mes del corte.
 * @property {number|null} statementTotal Total del extracto.
 * @property {string|null} statementDueDate Fecha límite del extracto AAAA-MM-DD.
 * @property {string|null} reminderSentFor Fecha de pago ya avisada AAAA-MM-DD.
 * @property {Date} createdAt Fecha de creación.
 * @property {Date} updatedAt Fecha de última modificación.
 */

const COLUMNS = `id, usuario_id AS "userId", nombre AS name, franquicia AS network, nivel AS tier,
  ultimos4 AS last4, cupo_total::float8 AS "limit", deuda_base::float8 AS "debtBase",
  base_at AS "baseAt", dia_pago::int AS "paymentDay", dia_corte::int AS "cutoffDay",
  total_extracto::float8 AS "statementTotal",
  to_char(fecha_limite_extracto, 'YYYY-MM-DD') AS "statementDueDate",
  to_char(recordatorio_enviado_para, 'YYYY-MM-DD') AS "reminderSentFor",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Campo de `CardRecord` editable con `updateCard` → columna. */
const UPDATABLE = {
  name: 'nombre',
  network: 'franquicia',
  tier: 'nivel',
  last4: 'ultimos4',
  limit: 'cupo_total',
  paymentDay: 'dia_pago',
  cutoffDay: 'dia_corte',
  statementTotal: 'total_extracto',
  statementDueDate: 'fecha_limite_extracto',
  reminderSentFor: 'recordatorio_enviado_para',
};

/**
 * Inserta una tarjeta.
 * @param {{ userId: string, name: string, network: string, tier: string, last4: string, limit: number, debtBase: number, paymentDay: number, cutoffDay?: number|null }} data
 * @returns {Promise<CardRecord>}
 */
export async function insertCard(data) {
  const { rows } = await pool.query(
    `INSERT INTO tarjetas (usuario_id, nombre, franquicia, nivel, ultimos4, cupo_total, deuda_base, dia_pago, dia_corte)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLUMNS}`,
    [
      data.userId,
      data.name,
      data.network,
      data.tier,
      data.last4,
      data.limit,
      data.debtBase,
      data.paymentDay,
      data.cutoffDay ?? null,
    ],
  );
  return rows[0];
}

/**
 * Tarjetas no borradas del usuario, de la más antigua a la más nueva.
 * @param {string} userId
 * @returns {Promise<CardRecord[]>}
 */
export async function listCards(userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM tarjetas WHERE usuario_id = $1 AND deleted_at IS NULL
     ORDER BY created_at, id`,
    [userId],
  );
  return rows;
}

/**
 * Busca una tarjeta de un usuario (RN-01: nunca la de otro).
 * @param {string} id
 * @param {string} userId
 * @param {{ includeDeleted?: boolean }} [options]
 * @returns {Promise<CardRecord|null>}
 */
export async function findCard(id, userId, { includeDeleted = false } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM tarjetas
     WHERE id = $1 AND usuario_id = $2 AND ($3::boolean OR deleted_at IS NULL)`,
    [id, userId, includeDeleted],
  );
  return rows[0] ?? null;
}

/**
 * Modifica solo los campos presentes en `changes` (los de `UPDATABLE`; `null` limpia los opcionales).
 * @param {string} id
 * @param {string} userId
 * @param {Partial<Pick<CardRecord, 'name'|'network'|'tier'|'last4'|'limit'|'paymentDay'|'cutoffDay'|'statementTotal'|'statementDueDate'|'reminderSentFor'>>} changes
 * @returns {Promise<CardRecord|null>} `null` si no existe o está borrada.
 */
export async function updateCard(id, userId, changes) {
  const keys = Object.keys(UPDATABLE).filter((k) => changes[k] !== undefined);
  if (keys.length === 0) return findCard(id, userId);
  const sets = keys.map((k, i) => `${UPDATABLE[k]} = $${i + 3}`);
  const { rows } = await pool.query(
    `UPDATE tarjetas SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $1 AND usuario_id = $2 AND deleted_at IS NULL
     RETURNING ${COLUMNS}`,
    [id, userId, ...keys.map((k) => changes[k])],
  );
  return rows[0] ?? null;
}

/**
 * Borrado lógico de la tarjeta.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<boolean>} `false` si no existía o ya estaba borrada.
 */
export async function softDeleteCard(id, userId) {
  const { rowCount } = await pool.query(
    `UPDATE tarjetas SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND usuario_id = $2 AND deleted_at IS NULL`,
    [id, userId],
  );
  return rowCount > 0;
}

/**
 * Fija una nueva deuda base desde `baseAt`. El extracto solo cambia si se pasa (no `undefined`).
 * @param {string} id
 * @param {string} userId
 * @param {{ debtBase: number, baseAt: Date, statementTotal?: number|null, statementDueDate?: string|null }} data
 * @param {import("pg").PoolClient|import("pg").Pool} [client] Cliente de una transacción SQL (por defecto, el pool).
 * @returns {Promise<CardRecord|null>}
 */
export async function rebaseCard(id, userId, data, client = pool) {
  const hasStatement = data.statementTotal !== undefined;
  const hasDue = data.statementDueDate !== undefined;
  const { rows } = await client.query(
    `UPDATE tarjetas SET deuda_base = $3, base_at = $4,
       total_extracto = CASE WHEN $5::boolean THEN $6 ELSE total_extracto END,
       fecha_limite_extracto = CASE WHEN $7::boolean THEN $8 ELSE fecha_limite_extracto END,
       updated_at = now()
     WHERE id = $1 AND usuario_id = $2 AND deleted_at IS NULL
     RETURNING ${COLUMNS}`,
    [
      id,
      userId,
      data.debtBase,
      data.baseAt,
      hasStatement,
      hasStatement ? data.statementTotal : null,
      hasDue,
      hasDue ? data.statementDueDate : null,
    ],
  );
  return rows[0] ?? null;
}

/**
 * Suma de los gastos con la tarjeta registrados después de la base. Misma regla que
 * `changesSinceBalance`: un gasto con fecha anterior al día de la base ya estaba incluido.
 * @param {string} cardId
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function purchasesSince(cardId, userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(t.monto), 0)::float8 AS total
     FROM tarjetas k
     JOIN usuarios u ON u.id = k.usuario_id
     JOIN transacciones t ON t.tarjeta_id = k.id AND t.usuario_id = k.usuario_id
     WHERE k.id = $1 AND k.usuario_id = $2 AND t.tipo = 'gasto' AND t.deleted_at IS NULL
       AND t.created_at > k.base_at AND t.fecha >= (k.base_at AT TIME ZONE u.timezone)::date`,
    [cardId, userId],
  );
  return rows[0].total;
}

/**
 * Pagos no borrados registrados después de la base.
 * @param {string} cardId
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, date: string, amount: number }>>}
 */
export async function paymentsSince(cardId, userId) {
  const { rows } = await pool.query(
    `SELECT p.id, to_char(p.fecha, 'YYYY-MM-DD') AS date, p.monto::float8 AS amount
     FROM tarjetas k
     JOIN pagos_tarjeta p ON p.tarjeta_id = k.id AND p.usuario_id = k.usuario_id
     WHERE k.id = $1 AND k.usuario_id = $2 AND p.deleted_at IS NULL AND p.created_at > k.base_at
     ORDER BY p.fecha DESC, p.created_at DESC`,
    [cardId, userId],
  );
  return rows;
}

/**
 * Registra un pago a la tarjeta.
 * @param {{ userId: string, cardId: string, amount: number, date: string }} data
 * @param {import("pg").PoolClient|import("pg").Pool} [client] Cliente de una transacción SQL (por defecto, el pool).
 * @returns {Promise<{ id: string, date: string, amount: number }>}
 */
export async function insertPayment(data, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO pagos_tarjeta (usuario_id, tarjeta_id, monto, fecha) VALUES ($1, $2, $3, $4)
     RETURNING id, to_char(fecha, 'YYYY-MM-DD') AS date, monto::float8 AS amount`,
    [data.userId, data.cardId, data.amount, data.date],
  );
  return rows[0];
}

/**
 * Borrado lógico de un pago.
 * @param {string} id
 * @param {string} cardId
 * @param {string} userId
 * @returns {Promise<boolean>} `false` si no existía o ya estaba borrado.
 */
export async function softDeletePayment(id, cardId, userId) {
  const { rowCount } = await pool.query(
    `UPDATE pagos_tarjeta SET deleted_at = now()
     WHERE id = $1 AND tarjeta_id = $2 AND usuario_id = $3 AND deleted_at IS NULL`,
    [id, cardId, userId],
  );
  return rowCount > 0;
}

/**
 * Guarda un ajuste con el banco (diferencia firmada: negativa = el banco debe menos).
 * @param {{ userId: string, cardId: string, difference: number, transactionId?: string|null }} data
 * @param {import("pg").PoolClient|import("pg").Pool} [client] Cliente de una transacción SQL (por defecto, el pool).
 * @returns {Promise<{ id: string, difference: number, transactionId: string|null }>}
 */
export async function insertAdjustment(data, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO ajustes_tarjeta (usuario_id, tarjeta_id, diferencia, transaccion_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, diferencia::float8 AS difference, transaccion_id AS "transactionId"`,
    [data.userId, data.cardId, data.difference, data.transactionId ?? null],
  );
  return rows[0];
}

/**
 * Movimientos de la tarjeta: compras y pagos desde la base, y los ajustes negativos (pocos, se
 * devuelven todos). De la fecha más nueva a la más vieja.
 * @param {string} cardId
 * @param {string} userId
 * @returns {Promise<Array<{ kind: 'purchase'|'payment'|'adjustment', id: string, date: string, amount: number, description?: string, installments?: number|null }>>}
 */
export async function listMovements(cardId, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT 'purchase' AS kind, t.id, to_char(t.fecha, 'YYYY-MM-DD') AS date, t.monto::float8 AS amount,
              t.descripcion AS description, t.cuotas::int AS installments, t.created_at
       FROM tarjetas k
       JOIN usuarios u ON u.id = k.usuario_id
       JOIN transacciones t ON t.tarjeta_id = k.id AND t.usuario_id = k.usuario_id
       WHERE k.id = $1 AND k.usuario_id = $2 AND t.tipo = 'gasto' AND t.deleted_at IS NULL
         AND t.created_at > k.base_at AND t.fecha >= (k.base_at AT TIME ZONE u.timezone)::date
       UNION ALL
       SELECT 'payment', p.id, to_char(p.fecha, 'YYYY-MM-DD'), p.monto::float8, NULL, NULL, p.created_at
       FROM tarjetas k
       JOIN pagos_tarjeta p ON p.tarjeta_id = k.id AND p.usuario_id = k.usuario_id
       WHERE k.id = $1 AND k.usuario_id = $2 AND p.deleted_at IS NULL AND p.created_at > k.base_at
       UNION ALL
       SELECT 'adjustment', a.id, to_char(a.created_at AT TIME ZONE u.timezone, 'YYYY-MM-DD'),
              a.diferencia::float8, NULL, NULL, a.created_at
       FROM tarjetas k
       JOIN usuarios u ON u.id = k.usuario_id
       JOIN ajustes_tarjeta a ON a.tarjeta_id = k.id AND a.usuario_id = k.usuario_id
       WHERE k.id = $1 AND k.usuario_id = $2 AND a.diferencia < 0
     ) m ORDER BY date DESC, created_at DESC`,
    [cardId, userId],
  );
  return rows.map(({ created_at: _createdAt, ...m }) =>
    m.kind === 'purchase' ? m : { kind: m.kind, id: m.id, date: m.date, amount: m.amount },
  );
}
