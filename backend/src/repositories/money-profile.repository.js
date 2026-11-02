import { pool } from '../config/db.js';

/**
 * @typedef {object} CommitmentRecord
 * @property {string} id UUID del compromiso.
 * @property {string} name Nombre con el que el usuario lo reconoce.
 * @property {number} amount Monto mensual.
 * @property {number} dayOfMonth Día del mes en que se paga.
 */

/**
 * @typedef {object} ProfileRecord
 * @property {'fecha_fija'|'sin_fecha'|null} incomeType
 * @property {number[]} payDays
 * @property {number|null} balance Plata que el usuario dijo tener.
 * @property {Date|null} balanceAt Cuándo lo dijo.
 * @property {Date|null} welcomeAt Cuándo respondió u omitió la bienvenida.
 */

const COMMITMENT_COLUMNS = `id, nombre AS name, monto::float8 AS amount, dia_mes::int AS "dayOfMonth"`;

/**
 * Guarda el perfil. La hora del saldo solo cambia si cambió el saldo: si no, lo registrado
 * desde entonces dejaría de contar.
 */
const SAVE_PROFILE = `INSERT INTO perfiles_financieros AS p
    (usuario_id, tipo_ingreso, dias_pago, saldo_inicial, saldo_at, bienvenida_at)
  VALUES ($1, $2, $3, $4, CASE WHEN $4::numeric IS NULL THEN NULL ELSE now() END, CASE WHEN $5 THEN now() END)
  ON CONFLICT (usuario_id) DO UPDATE SET
    tipo_ingreso = EXCLUDED.tipo_ingreso,
    dias_pago = EXCLUDED.dias_pago,
    saldo_inicial = EXCLUDED.saldo_inicial,
    saldo_at = CASE WHEN p.saldo_inicial IS NOT DISTINCT FROM EXCLUDED.saldo_inicial THEN p.saldo_at
                    ELSE EXCLUDED.saldo_at END,
    bienvenida_at = COALESCE(p.bienvenida_at, EXCLUDED.bienvenida_at),
    updated_at = now()`;

const UNIQUE_VIOLATION = '23505';

/**
 * Perfil del usuario.
 * @param {string} userId
 * @returns {Promise<ProfileRecord|null>} `null` si todavía no tiene.
 */
export async function findProfile(userId) {
  const { rows } = await pool.query(
    `SELECT tipo_ingreso AS "incomeType", dias_pago::int[] AS "payDays",
            saldo_inicial::float8 AS balance, saldo_at AS "balanceAt", bienvenida_at AS "welcomeAt"
     FROM perfiles_financieros WHERE usuario_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Lo registrado después de que el usuario dijo cuánta plata tenía. Un movimiento nuevo con fecha
 * anterior a ese día ya estaba incluido en el saldo: no se cuenta.
 * @param {string} userId
 * @returns {Promise<{ income: number, expense: number }>}
 */
export async function changesSinceBalance(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(t.monto) FILTER (WHERE t.tipo = 'ingreso'), 0)::float8 AS income,
            COALESCE(SUM(t.monto) FILTER (WHERE t.tipo = 'gasto'), 0)::float8 AS expense
     FROM perfiles_financieros p
     JOIN usuarios u ON u.id = p.usuario_id
     JOIN transacciones t ON t.usuario_id = p.usuario_id
     WHERE p.usuario_id = $1 AND t.deleted_at IS NULL AND t.created_at > p.saldo_at
       AND t.fecha >= (p.saldo_at AT TIME ZONE u.timezone)::date`,
    [userId],
  );
  return rows[0];
}

/**
 * Crea o reemplaza el perfil.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').ProfileData} data
 * @returns {Promise<void>}
 */
export async function saveProfile(userId, { incomeType, payDays, balance }) {
  await pool.query(SAVE_PROFILE, [userId, incomeType, payDays, balance, false]);
}

/**
 * Guarda de una vez lo respondido en la bienvenida y la marca como vista. Reintentar no repite
 * compromisos ni pisa los que ya existían.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').ProfileData & { commitments: import('../validators/money-profile.validator.js').NewCommitment[] }} data
 * @returns {Promise<void>}
 */
export async function saveWelcome(userId, { incomeType, payDays, balance, commitments }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SAVE_PROFILE, [userId, incomeType, payDays, balance, true]);
    for (const { name, amount, dayOfMonth } of commitments) {
      await client.query(
        `INSERT INTO compromisos (usuario_id, nombre, monto, dia_mes) VALUES ($1, $2, $3, $4)
         ON CONFLICT (usuario_id, lower(nombre)) DO NOTHING`,
        [userId, name, amount, dayOfMonth],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Compromisos del usuario, por día de pago.
 * @param {string} userId
 * @returns {Promise<CommitmentRecord[]>}
 */
export async function listCommitments(userId) {
  const { rows } = await pool.query(
    `SELECT ${COMMITMENT_COLUMNS} FROM compromisos WHERE usuario_id = $1 ORDER BY dia_mes, lower(nombre)`,
    [userId],
  );
  return rows;
}

/**
 * Cuántos compromisos tiene el usuario.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countCommitments(userId) {
  const { rows } = await pool.query('SELECT count(*)::int AS total FROM compromisos WHERE usuario_id = $1', [userId]);
  return rows[0].total;
}

/**
 * Crea un compromiso. Si ya hay uno con ese nombre no inserta nada.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').NewCommitment} data
 * @returns {Promise<CommitmentRecord|null>} `null` si el nombre ya existía.
 */
export async function insertCommitment(userId, { name, amount, dayOfMonth }) {
  const { rows } = await pool.query(
    `INSERT INTO compromisos (usuario_id, nombre, monto, dia_mes) VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario_id, lower(nombre)) DO NOTHING
     RETURNING ${COMMITMENT_COLUMNS}`,
    [userId, name, amount, dayOfMonth],
  );
  return rows[0] ?? null;
}

/**
 * Cambia un compromiso propio (RN-01: nunca el de otro usuario).
 * @param {string} id
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').NewCommitment} data
 * @returns {Promise<CommitmentRecord|'duplicate'|null>} `'duplicate'` si el nombre ya lo usa otro; `null` si no existe.
 */
export async function updateCommitment(id, userId, { name, amount, dayOfMonth }) {
  try {
    const { rows } = await pool.query(
      `UPDATE compromisos SET nombre = $3, monto = $4, dia_mes = $5
       WHERE id = $1 AND usuario_id = $2 RETURNING ${COMMITMENT_COLUMNS}`,
      [id, userId, name, amount, dayOfMonth],
    );
    return rows[0] ?? null;
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return 'duplicate';
    throw err;
  }
}

/**
 * Elimina un compromiso propio.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<boolean>} `false` si no existe o es de otro usuario.
 */
export async function deleteCommitment(id, userId) {
  const { rowCount } = await pool.query('DELETE FROM compromisos WHERE id = $1 AND usuario_id = $2', [id, userId]);
  return rowCount > 0;
}
