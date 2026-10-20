import { pool } from '../config/db.js';

/**
 * @typedef {object} TransactionRecord
 * @property {string} id UUID de la transacción.
 * @property {string} userId UUID del dueño.
 * @property {number} amount Monto (siempre positivo; el signo lo da `type`).
 * @property {string} description Descripción libre.
 * @property {'ingreso'|'gasto'} type Tipo de movimiento.
 * @property {string|null} category Clave de la categoría, o `null` si está sin clasificar.
 * @property {'manual'|'ia'|'sin_clasificar'} source Cómo se asignó la categoría.
 * @property {string} date Fecha AAAA-MM-DD.
 * @property {Date} createdAt Fecha de creación.
 * @property {Date} updatedAt Fecha de última modificación.
 * @property {Date|null} deletedAt Fecha de borrado lógico (siempre `null` en lo que devuelve la API).
 */

export const COLUMNS = `t.id, t.usuario_id AS "userId", t.monto::float8 AS amount,
  t.descripcion AS description, t.tipo AS type, c.key AS category, t.origen AS source,
  to_char(t.fecha, 'YYYY-MM-DD') AS date, t.created_at AS "createdAt",
  t.updated_at AS "updatedAt", t.deleted_at AS "deletedAt"`;

/** Une la transacción con su categoría para obtener la clave. */
export const JOIN = 'LEFT JOIN categorias c ON c.id = t.categoria_id';

/**
 * Inserta una transacción.
 * @param {{ userId: string, amount: number, description: string, type: 'ingreso'|'gasto', date: string, category: string|null, source: 'manual'|'ia'|'sin_clasificar' }} data
 * @returns {Promise<TransactionRecord>}
 */
export async function insertTransaction(data) {
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO transacciones (usuario_id, categoria_id, monto, descripcion, tipo, fecha, origen)
       VALUES ($1, (SELECT id FROM categorias WHERE key = $2), $3, $4, $5, $6, $7)
       RETURNING *
     )
     SELECT ${COLUMNS} FROM ins t ${JOIN}`,
    [data.userId, data.category, data.amount, data.description, data.type, data.date, data.source],
  );
  return rows[0];
}

/**
 * Busca una transacción no borrada de un usuario (RN-01: nunca la de otro).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<TransactionRecord|null>}
 */
export async function findTransaction(id, userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM transacciones t ${JOIN}
     WHERE t.id = $1 AND t.usuario_id = $2 AND t.deleted_at IS NULL`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * Lista las transacciones de un usuario, de la más reciente a la más antigua.
 * @param {{ userId: string, type?: string, category?: string, q?: string, from?: string, to?: string, limit: number, offset: number }} filters
 * @returns {Promise<{ rows: TransactionRecord[], total: number }>}
 */
export async function listTransactions({ userId, type, category, q, from, to, limit, offset }) {
  const params = [userId];
  const where = ['t.usuario_id = $1', 't.deleted_at IS NULL'];
  const add = (condition, value) => {
    params.push(value);
    where.push(condition.replace('?', `$${params.length}`));
  };
  if (type) add('t.tipo = ?', type);
  if (category) add('c.key = ?', category);
  // Búsqueda por texto en la descripción; se escapan % y _ para tomarlos literalmente.
  if (q) add("t.descripcion ILIKE ? ESCAPE '\\'", `%${q.replace(/[\\%_]/g, '\\$&')}%`);
  if (from) add('t.fecha >= ?', from);
  if (to) add('t.fecha <= ?', to);
  const clause = where.join(' AND ');

  const [data, count] = await Promise.all([
    pool.query(
      `SELECT ${COLUMNS} FROM transacciones t ${JOIN}
       WHERE ${clause}
       ORDER BY t.fecha DESC, t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM transacciones t ${JOIN} WHERE ${clause}`,
      params,
    ),
  ]);
  return { rows: data.rows, total: count.rows[0].total };
}

/**
 * Modifica los campos indicados de una transacción del usuario.
 * @param {string} id
 * @param {string} userId
 * @param {{ amount?: number, description?: string, type?: string, date?: string, category?: string|null, source?: string }} changes
 * @returns {Promise<TransactionRecord|null>} La transacción actualizada, o `null` si no existe o no es suya.
 */
export async function updateTransaction(id, userId, changes) {
  const params = [id, userId];
  const sets = ['updated_at = now()'];
  const set = (column, value) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (changes.amount !== undefined) set('monto', changes.amount);
  if (changes.description !== undefined) set('descripcion', changes.description);
  if (changes.type !== undefined) set('tipo', changes.type);
  if (changes.date !== undefined) set('fecha', changes.date);
  if (changes.source !== undefined) set('origen', changes.source);
  if (changes.category !== undefined) {
    params.push(changes.category);
    sets.push(`categoria_id = (SELECT id FROM categorias WHERE key = $${params.length})`);
  }

  const { rows } = await pool.query(
    `WITH upd AS (
       UPDATE transacciones t SET ${sets.join(', ')}
       WHERE t.id = $1 AND t.usuario_id = $2 AND t.deleted_at IS NULL
       RETURNING t.*
     )
     SELECT ${COLUMNS} FROM upd t ${JOIN}`,
    params,
  );
  return rows[0] ?? null;
}

/**
 * Borrado lógico: marca `deleted_at` para que la sincronización pueda propagarlo.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<boolean>} `true` si se borró; `false` si no existe o no es del usuario.
 */
export async function softDeleteTransaction(id, userId) {
  const { rowCount } = await pool.query(
    `UPDATE transacciones SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND usuario_id = $2 AND deleted_at IS NULL`,
    [id, userId],
  );
  return rowCount > 0;
}

/**
 * Suma los montos del usuario entre dos fechas (inclusive), sin contar las borradas.
 * Devuelve dos agrupaciones: por categoría (para la dona) y por día o mes (para las barras).
 * Con `groupBy: 'month'` cada punto de la serie usa el día 1 del mes como fecha.
 * @param {{ userId: string, from: string, to: string, groupBy: 'day'|'month' }} range
 * @returns {Promise<{
 *   byCategory: Array<{ type: 'ingreso'|'gasto', category: string|null, total: number }>,
 *   series: Array<{ date: string, type: 'ingreso'|'gasto', total: number }>
 * }>}
 */
export async function summarizeTransactions({ userId, from, to, groupBy }) {
  const where = 't.usuario_id = $1 AND t.deleted_at IS NULL AND t.fecha BETWEEN $2 AND $3';
  const params = [userId, from, to];
  const bucket = groupBy === 'month' ? "date_trunc('month', t.fecha)" : 't.fecha';

  const [byCategory, series] = await Promise.all([
    pool.query(
      `SELECT t.tipo AS type, c.key AS category, round(sum(t.monto), 2)::float8 AS total
       FROM transacciones t ${JOIN}
       WHERE ${where}
       GROUP BY t.tipo, c.key
       ORDER BY total DESC`,
      params,
    ),
    pool.query(
      `SELECT to_char(${bucket}, 'YYYY-MM-DD') AS date, t.tipo AS type,
              round(sum(t.monto), 2)::float8 AS total
       FROM transacciones t
       WHERE ${where}
       GROUP BY 1, t.tipo
       ORDER BY 1`,
      params,
    ),
  ]);
  return { byCategory: byCategory.rows, series: series.rows };
}

/**
 * Movimientos de un usuario entre dos fechas (incluidas) para exportarlos, del más antiguo al
 * más reciente. Trae el nombre legible de la categoría en vez de su clave.
 * @param {{ userId: string, from: string, to: string }} filters Fechas AAAA-MM-DD ya validadas.
 * @returns {Promise<Array<{ date: string, type: 'ingreso'|'gasto', categoryName: string|null, description: string, amount: number, source: 'manual'|'ia'|'sin_clasificar' }>>}
 */
export async function listForExport({ userId, from, to }) {
  const { rows } = await pool.query(
    `SELECT to_char(t.fecha, 'YYYY-MM-DD') AS date, t.tipo AS type, c.nombre AS "categoryName",
            t.descripcion AS description, t.monto::float8 AS amount, t.origen AS source
       FROM transacciones t ${JOIN}
      WHERE t.usuario_id = $1 AND t.deleted_at IS NULL AND t.fecha BETWEEN $2 AND $3
      ORDER BY t.fecha ASC, t.created_at ASC`,
    [userId, from, to],
  );
  return rows;
}
