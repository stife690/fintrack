import { pool } from '../config/db.js';

/**
 * @typedef {object} Category
 * @property {number} id Identificador de la categoría.
 * @property {string} key Clave estable usada por la API (p. ej. `alimentacion`).
 * @property {string} name Nombre legible.
 * @property {'ingreso'|'gasto'} type Tipo de movimiento al que aplica.
 * @property {string|null} icon Ícono elegido (solo las propias del usuario).
 * @property {string|null} color Color elegido (solo las propias del usuario).
 * @property {boolean} custom `true` si la creó el usuario; `false` en las 15 de todos.
 */

const COLUMNS = `id, key, nombre AS name, tipo AS type, icono AS icon, color,
  (usuario_id IS NOT NULL) AS custom`;

/** Las de todos más, si se indica, las del usuario (RN-02). Nunca las de otro usuario (RN-01). */
const VISIBLE = '(usuario_id IS NULL OR usuario_id = $1)';

/**
 * Lista las categorías que puede usar el usuario: las 15 de todos y las suyas. Sin `userId`
 * devuelve solo las de todos.
 * @param {string} [userId]
 * @returns {Promise<Category[]>}
 */
export async function listCategories(userId = null) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM categorias WHERE ${VISIBLE} ORDER BY usuario_id NULLS FIRST, id`,
    [userId],
  );
  return rows;
}

/**
 * Busca una categoría por su clave entre las que puede usar el usuario.
 * @param {string} key
 * @param {string} [userId]
 * @returns {Promise<Category|null>}
 */
export async function findCategoryByKey(key, userId = null) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM categorias WHERE key = $2 AND ${VISIBLE}`,
    [userId, key],
  );
  return rows[0] ?? null;
}

/**
 * Cuántas categorías propias tiene el usuario.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countOwnCategories(userId) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS total FROM categorias WHERE usuario_id = $1',
    [userId],
  );
  return rows[0].total;
}

/**
 * ¿Ya hay una categoría con ese nombre (sin importar mayúsculas) entre las que ve el usuario?
 * @param {string} userId
 * @param {string} name
 * @param {string} [exceptKey] Para renombrar: no se compara consigo misma.
 * @returns {Promise<boolean>}
 */
export async function nameTaken(userId, name, exceptKey = null) {
  const { rows } = await pool.query(
    `SELECT 1 FROM categorias
      WHERE ${VISIBLE} AND lower(nombre) = lower($2) AND ($3::text IS NULL OR key <> $3)`,
    [userId, name, exceptKey],
  );
  return rows.length > 0;
}

/**
 * Crea una categoría propia del usuario.
 * @param {{ userId: string, key: string, name: string, type: 'ingreso'|'gasto', icon: string, color: string }} input
 * @returns {Promise<Category>}
 */
export async function insertCategory({ userId, key, name, type, icon, color }) {
  const { rows } = await pool.query(
    `INSERT INTO categorias (key, nombre, tipo, usuario_id, icono, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [key, name, type, userId, icon, color],
  );
  return rows[0];
}

/**
 * Cambia nombre, ícono o color de una categoría propia. Las de todos no se pueden editar.
 * @param {string} userId
 * @param {string} key
 * @param {{ name?: string, icon?: string, color?: string }} changes
 * @returns {Promise<Category|null>} `null` si no existe o no es del usuario.
 */
export async function updateCategory(userId, key, { name, icon, color }) {
  const { rows } = await pool.query(
    `UPDATE categorias
        SET nombre = COALESCE($3, nombre), icono = COALESCE($4, icono), color = COALESCE($5, color)
      WHERE key = $2 AND usuario_id = $1
      RETURNING ${COLUMNS}`,
    [userId, key, name ?? null, icon ?? null, color ?? null],
  );
  return rows[0] ?? null;
}

/**
 * Elimina una categoría propia sin perder movimientos: los que la usaban pasan a `fallbackKey`
 * ("Otros" u "Otros ingresos") y sus presupuestos se borran. Todo o nada, en una transacción.
 * @param {string} userId
 * @param {string} key
 * @param {string} fallbackKey Categoría de todos a la que pasan los movimientos.
 * @returns {Promise<{ moved: number }|null>} `null` si no existe o no es del usuario.
 */
export async function deleteCategory(userId, key, fallbackKey) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id FROM categorias WHERE key = $1 AND usuario_id = $2 FOR UPDATE',
      [key, userId],
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const { id } = rows[0];
    // updated_at cambia para que los otros dispositivos reciban el cambio al sincronizar.
    const moved = await client.query(
      `UPDATE transacciones
          SET categoria_id = (SELECT id FROM categorias WHERE key = $2 AND usuario_id IS NULL),
              updated_at = now()
        WHERE categoria_id = $1`,
      [id, fallbackKey],
    );
    await client.query('DELETE FROM presupuestos WHERE categoria_id = $1', [id]);
    await client.query('DELETE FROM categorias WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { moved: moved.rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
