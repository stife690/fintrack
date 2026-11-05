import { pool } from '../config/db.js';

/**
 * @typedef {object} BusinessMovementRecord
 * @property {string} id UUID del movimiento.
 * @property {'sale'|'otherIncome'|'cost'|'fixed'|'variable'|'withdrawal'} kind Venta, otro ingreso, costo de venta, gasto fijo o variable, o retiro de un socio.
 * @property {string} category Clave de la categoría del negocio.
 * @property {number} amount Monto.
 * @property {string} description Descripción.
 * @property {string} date AAAA-MM-DD.
 * @property {{ id: string, name: string|null }|null} registeredBy Quién lo registró (`null` si borró su cuenta).
 * @property {Date} createdAt Cuándo se registró.
 */

const KIND = `CASE m.tipo WHEN 'venta' THEN 'sale' WHEN 'otro_ingreso' THEN 'otherIncome'
  WHEN 'costo_venta' THEN 'cost' WHEN 'gasto_fijo' THEN 'fixed' WHEN 'retiro' THEN 'withdrawal'
  ELSE 'variable' END`;

const COLUMNS = `m.id, ${KIND} AS kind, m.categoria AS category, m.monto::float8 AS amount,
  m.descripcion AS description, to_char(m.fecha, 'YYYY-MM-DD') AS date, m.created_at AS "createdAt",
  CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'name', u.nombre) END
    AS "registeredBy"`;

/**
 * Movimientos del negocio entre dos fechas, del más reciente al más viejo.
 * @param {string} businessId
 * @param {string} from AAAA-MM-DD.
 * @param {string} to AAAA-MM-DD.
 * @returns {Promise<BusinessMovementRecord[]>}
 */
export async function listMovements(businessId, from, to) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM negocio_movimientos m LEFT JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.negocio_id = $1 AND m.fecha BETWEEN $2 AND $3
     ORDER BY m.fecha DESC, m.created_at DESC`,
    [businessId, from, to],
  );
  return rows;
}

/**
 * Registra un movimiento. Si ya hay uno con el mismo `localId` en el negocio no hace nada.
 * @param {{ businessId: string, userId: string, kindDb: string, category: string, amount: number, description: string, date: string, localId?: string|null, transactionId?: string|null }} data
 * @returns {Promise<BusinessMovementRecord|undefined>} `undefined` si el `localId` ya existía.
 */
export async function insertMovement(data) {
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO negocio_movimientos
         (negocio_id, usuario_id, tipo, categoria, monto, descripcion, fecha, local_id, transaccion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (negocio_id, local_id) WHERE local_id IS NOT NULL DO NOTHING
       RETURNING *
     )
     SELECT ${COLUMNS} FROM ins m LEFT JOIN usuarios u ON u.id = m.usuario_id`,
    [
      data.businessId,
      data.userId,
      data.kindDb,
      data.category,
      data.amount,
      data.description,
      data.date,
      data.localId ?? null,
      data.transactionId ?? null,
    ],
  );
  return rows[0];
}

/**
 * @param {string} businessId
 * @param {string} localId
 * @returns {Promise<BusinessMovementRecord|null>}
 */
export async function findByLocalId(businessId, localId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM negocio_movimientos m LEFT JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.negocio_id = $1 AND m.local_id = $2`,
    [businessId, localId],
  );
  return rows[0] ?? null;
}

/**
 * @param {string} businessId
 * @param {string} id
 * @returns {Promise<{ id: string, authorId: string|null, kind: string, transactionId: string|null }|null>}
 */
export async function findMovement(businessId, id) {
  const { rows } = await pool.query(
    `SELECT m.id, m.usuario_id AS "authorId", ${KIND} AS kind, m.transaccion_id AS "transactionId"
     FROM negocio_movimientos m WHERE m.negocio_id = $1 AND m.id = $2`,
    [businessId, id],
  );
  return rows[0] ?? null;
}

/**
 * @param {string} businessId
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteMovement(businessId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM negocio_movimientos WHERE negocio_id = $1 AND id = $2',
    [businessId, id],
  );
  return rowCount > 0;
}
