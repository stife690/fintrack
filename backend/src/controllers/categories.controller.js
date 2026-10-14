import { listCategories } from '../repositories/categories.repository.js';

/**
 * `GET /api/v1/categories`: catálogo cerrado separado en gastos (`expense`) e ingresos (`income`).
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getCategories(_req, res) {
  const categories = await listCategories();
  const pick = (type) =>
    categories.filter((c) => c.type === type).map(({ key, name }) => ({ key, name }));
  res.json({ expense: pick('gasto'), income: pick('ingreso') });
}
