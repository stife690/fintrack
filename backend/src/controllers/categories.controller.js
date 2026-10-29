import * as categories from '../services/categories.service.js';
import { parseCategoryChanges, parseNewCategory } from '../validators/categories.validator.js';

/**
 * `GET /api/v1/categories`: las 15 de todos y las propias del usuario, separadas en gastos
 * (`expense`) e ingresos (`income`).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getCategories(req, res) {
  res.json(await categories.list(req.userId));
}

/**
 * `POST /api/v1/categories`: crea una categoría propia.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postCategory(req, res) {
  res.status(201).json(await categories.create(req.userId, parseNewCategory(req.body)));
}

/**
 * `PATCH /api/v1/categories/:key`: cambia nombre, ícono o color de una categoría propia.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function patchCategory(req, res) {
  res.json(await categories.update(req.userId, req.params.key, parseCategoryChanges(req.body)));
}

/**
 * `DELETE /api/v1/categories/:key`: elimina una categoría propia; sus movimientos pasan a "Otros".
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteCategory(req, res) {
  res.json(await categories.remove(req.userId, req.params.key));
}
