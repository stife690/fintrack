import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import { suggestCategory } from '../services/categorization.service.js';

const MAX_DESCRIPTION_LENGTH = 200;

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

/**
 * `POST /api/v1/categories/suggest`: sugiere la categoría de una descripción con IA.
 * Siempre responde 200: si la IA no responde o contesta algo fuera del catálogo,
 * `category` es `null` y `source` es `sin_clasificar`.
 * @param {import('express').Request} req Cuerpo: `{ description, type }`.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postSuggestCategory(req, res) {
  const { description, type } = req.body ?? {};
  const details = [];
  if (typeof description !== 'string' || description.trim() === '') {
    details.push({ field: 'description', problem: 'Es obligatoria' });
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    details.push({
      field: 'description',
      problem: `Máximo ${MAX_DESCRIPTION_LENGTH} caracteres`,
    });
  }
  if (type !== 'ingreso' && type !== 'gasto') {
    details.push({ field: 'type', problem: 'Debe ser "ingreso" o "gasto"' });
  }
  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }

  res.json(await suggestCategory({ description: description.trim(), type }));
}
