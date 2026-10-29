import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/categories.repository.js';

/** Categorías propias que puede tener cada usuario. */
export const MAX_OWN_CATEGORIES = 20;

/** A dónde pasan los movimientos de una categoría propia que se elimina. */
const FALLBACK = { gasto: 'otros', ingreso: 'otros_ingresos' };

/** @returns {AppError} 404 sin revelar si la categoría existe pero es de otro (RN-01). */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Categoría no encontrada');
}

/** @returns {AppError} 409: ya hay una categoría con ese nombre entre las que ve el usuario. */
function nameExists() {
  return new AppError(409, 'CATEGORY_EXISTS', 'Ya tienes una categoría con ese nombre');
}

/**
 * Clave nueva para una categoría propia: `c_` y 10 caracteres al azar. Nunca choca con las de
 * todos (ninguna empieza por `c_`) y no revela nada del usuario.
 * @returns {string}
 */
export function newCategoryKey() {
  const random = randomBytes(12)
    .toString('base64url')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `c_${random.slice(0, 10)}`;
}

/**
 * Pasa una categoría al formato de la API.
 * @param {import('../repositories/categories.repository.js').Category} c
 * @returns {{ key: string, name: string, icon: string|null, color: string|null, custom: boolean }}
 */
function present(c) {
  return { key: c.key, name: c.name, icon: c.icon, color: c.color, custom: c.custom };
}

/**
 * Categorías que puede usar el usuario, separadas por tipo: primero las 15 de todos, luego las suyas.
 * @param {string} userId
 * @returns {Promise<{ expense: object[], income: object[] }>}
 */
export async function list(userId) {
  const categories = await repo.listCategories(userId);
  const pick = (type) => categories.filter((c) => c.type === type).map(present);
  return { expense: pick('gasto'), income: pick('ingreso') };
}

/**
 * Crea una categoría propia (RN-02 con el cambio aprobado). Máximo `MAX_OWN_CATEGORIES` y sin
 * repetir el nombre de ninguna que ya vea el usuario, incluidas las de todos.
 * @param {string} userId
 * @param {{ name: string, type: 'ingreso'|'gasto', icon: string, color: string }} input Ya validado.
 * @returns {Promise<object>}
 * @throws {AppError} 409 `CATEGORY_LIMIT` o `CATEGORY_EXISTS`.
 */
export async function create(userId, input) {
  if ((await repo.countOwnCategories(userId)) >= MAX_OWN_CATEGORIES) {
    throw new AppError(
      409,
      'CATEGORY_LIMIT',
      `Puedes tener hasta ${MAX_OWN_CATEGORIES} categorías propias`,
    );
  }
  if (await repo.nameTaken(userId, input.name)) throw nameExists();
  try {
    return present(await repo.insertCategory({ ...input, userId, key: newCategoryKey() }));
  } catch (err) {
    // Dos peticiones a la vez con el mismo nombre: la segunda choca con el índice único.
    if (err.code === '23505') throw nameExists();
    throw err;
  }
}

/**
 * Cambia nombre, ícono o color de una categoría propia. Las 15 de todos no se pueden editar.
 * @param {string} userId
 * @param {string} key
 * @param {{ name?: string, icon?: string, color?: string }} changes Ya validados.
 * @returns {Promise<object>}
 * @throws {AppError} 404 si no es del usuario; 409 `CATEGORY_EXISTS` si el nombre ya está.
 */
export async function update(userId, key, changes) {
  if (changes.name && (await repo.nameTaken(userId, changes.name, key))) throw nameExists();
  const updated = await repo.updateCategory(userId, key, changes);
  if (!updated) throw notFound();
  return present(updated);
}

/**
 * Elimina una categoría propia. Sus movimientos pasan a "Otros" (u "Otros ingresos") y sus
 * presupuestos se borran: no se pierde ningún movimiento.
 * @param {string} userId
 * @param {string} key
 * @returns {Promise<{ moved: number }>} Cuántos movimientos cambiaron de categoría.
 * @throws {AppError} 404 si no es del usuario (o es una de las de todos).
 */
export async function remove(userId, key) {
  const category = await repo.findCategoryByKey(key, userId);
  if (!category || !category.custom) throw notFound();
  const result = await repo.deleteCategory(userId, key, FALLBACK[category.type]);
  if (!result) throw notFound();
  return result;
}
