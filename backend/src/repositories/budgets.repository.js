import { pool } from '../config/db.js';

/**
 * @typedef {object} BudgetRecord
 * @property {string} id UUID del presupuesto.
 * @property {string} category Clave de la categoría de gasto.
 * @property {string} month Mes AAAA-MM.
 * @property {number} amount Monto límite.
 * @property {number} consumed Suma de los gastos de esa categoría en ese mes.
 */

/**
 * Presupuesto + lo gastado: suma los gastos no borrados del usuario en esa
 * categoría y dentro del mes del presupuesto (desde el día 1 hasta antes del mes siguiente).
 */
const SELECT_WITH_CONSUMED = `SELECT p.id, c.key AS category, p.mes AS month,
  p.monto_limite::float8 AS amount,
  COALESCE((
    SELECT SUM(t.monto) FROM transacciones t
    WHERE t.usuario_id = p.usuario_id AND t.categoria_id = p.categoria_id
      AND t.tipo = 'gasto' AND t.deleted_at IS NULL
      AND t.fecha >= to_date(p.mes, 'YYYY-MM')
      AND t.fecha < to_date(p.mes, 'YYYY-MM') + INTERVAL '1 month'
  ), 0)::float8 AS consumed
  FROM presupuestos p JOIN categorias c ON c.id = p.categoria_id`;

/**
 * Crea un presupuesto. Si ya hay uno para esa categoría y mes (RN-03) no inserta nada.
 * @param {{ userId: string, categoryId: number, month: string, amount: number }} data
 * @returns {Promise<{ id: string, month: string, amount: number }|null>} `null` si ya existía.
 */
export async function insertBudget({ userId, categoryId, month, amount }) {
  const { rows } = await pool.query(
    `INSERT INTO presupuestos (usuario_id, categoria_id, mes, monto_limite)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario_id, categoria_id, mes) DO NOTHING
     RETURNING id, mes AS month, monto_limite::float8 AS amount`,
    [userId, categoryId, month, amount],
  );
  return rows[0] ?? null;
}

/**
 * Lista los presupuestos de un usuario en un mes, con lo gastado.
 * @param {string} userId
 * @param {string} month AAAA-MM
 * @returns {Promise<BudgetRecord[]>}
 */
export async function listBudgets(userId, month) {
  const { rows } = await pool.query(
    `${SELECT_WITH_CONSUMED} WHERE p.usuario_id = $1 AND p.mes = $2 ORDER BY c.id`,
    [userId, month],
  );
  return rows;
}

/**
 * Busca un presupuesto propio (RN-01: nunca el de otro usuario).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<BudgetRecord|null>}
 */
export async function findBudget(id, userId) {
  const { rows } = await pool.query(
    `${SELECT_WITH_CONSUMED} WHERE p.id = $1 AND p.usuario_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * Cambia el monto límite de un presupuesto propio.
 * @param {string} id
 * @param {string} userId
 * @param {number} amount
 * @returns {Promise<boolean>} `false` si no existe o es de otro usuario.
 */
export async function updateBudgetAmount(id, userId, amount) {
  const { rowCount } = await pool.query(
    'UPDATE presupuestos SET monto_limite = $3 WHERE id = $1 AND usuario_id = $2',
    [id, userId, amount],
  );
  return rowCount > 0;
}

/**
 * Elimina un presupuesto propio (sus alertas caen por ON DELETE CASCADE).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<boolean>} `false` si no existe o es de otro usuario.
 */
export async function deleteBudget(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM presupuestos WHERE id = $1 AND usuario_id = $2',
    [id, userId],
  );
  return rowCount > 0;
}

/**
 * Busca el presupuesto de una categoría en un mes, con lo gastado.
 * Lo usa la alerta que acompaña a cada transacción registrada o editada.
 * @param {string} userId
 * @param {string} categoryKey Clave de la categoría (p. ej. `alimentacion`).
 * @param {string} month AAAA-MM
 * @returns {Promise<BudgetRecord|null>} `null` si esa categoría no tiene presupuesto ese mes.
 */
export async function findBudgetForCategory(userId, categoryKey, month) {
  const { rows } = await pool.query(
    `${SELECT_WITH_CONSUMED} WHERE p.usuario_id = $1 AND c.key = $2 AND p.mes = $3`,
    [userId, categoryKey, month],
  );
  return rows[0] ?? null;
}