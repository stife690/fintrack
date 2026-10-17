import * as budgets from '../services/budgets.service.js';
import {
  parseBudgetAmount,
  parseMonthQuery,
  parseNewBudget,
} from '../validators/budgets.validator.js';

/**
 * `GET /api/v1/budgets?month=AAAA-MM`: presupuestos del mes con consumo, porcentaje y alerta.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getBudgets(req, res) {
  const month = parseMonthQuery(req.query);
  res.json(await budgets.list(req.userId, month));
}

/**
 * `POST /api/v1/budgets`: crea un presupuesto y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postBudget(req, res) {
  const data = parseNewBudget(req.body);
  res.status(201).json(await budgets.create(req.userId, data));
}

/**
 * `PUT /api/v1/budgets/:id`: cambia el monto y responde el presupuesto recalculado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putBudget(req, res) {
  const amount = parseBudgetAmount(req.body);
  res.json(await budgets.updateAmount(req.userId, req.params.id, amount));
}

/**
 * `DELETE /api/v1/budgets/:id`: elimina el presupuesto y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteBudget(req, res) {
  await budgets.remove(req.userId, req.params.id);
  res.status(204).end();
}