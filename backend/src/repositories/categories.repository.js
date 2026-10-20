import { pool } from '../config/db.js';

/**
 * @typedef {object} Category
 * @property {number} id Identificador de la categoría.
 * @property {string} key Clave estable usada por la API (p. ej. `alimentacion`).
 * @property {string} name Nombre legible.
 * @property {'ingreso'|'gasto'} type Tipo de movimiento al que aplica.
 */

/**
 * Lista el catálogo cerrado de categorías (RN-02).
 * @returns {Promise<Category[]>}
 */
export async function listCategories() {
  const { rows } = await pool.query(
    'SELECT id, key, nombre AS name, tipo AS type FROM categorias ORDER BY id',
  );
  return rows;
}

/**
 * Busca una categoría por su clave estable.
 * @param {string} key
 * @returns {Promise<Category|null>}
 */
export async function findCategoryByKey(key) {
  const { rows } = await pool.query(
    'SELECT id, key, nombre AS name, tipo AS type FROM categorias WHERE key = $1',
    [key],
  );
  return rows[0] ?? null;
}