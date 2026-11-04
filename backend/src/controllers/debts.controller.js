import * as debts from '../services/debts.service.js';
import { parseDebtChanges, parseNewDebt, parseSettle } from '../validators/debts.validator.js';

/**
 * `GET /api/v1/debts`: cuentas del usuario y lo pendiente de cada lado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getDebts(req, res) {
  res.json(await debts.list(req.userId));
}

/**
 * `POST /api/v1/debts`: crea la cuenta y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postDebt(req, res) {
  res.status(201).json(await debts.create(req.userId, parseNewDebt(req.body)));
}

/**
 * `PUT /api/v1/debts/:id`: edita una cuenta pendiente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putDebt(req, res) {
  res.json(await debts.update(req.userId, req.params.id, parseDebtChanges(req.body)));
}

/**
 * `DELETE /api/v1/debts/:id`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteDebt(req, res) {
  await debts.remove(req.userId, req.params.id);
  res.status(204).end();
}

/**
 * `POST /api/v1/debts/:id/settle`: la salda y, si se pide, crea el movimiento.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postSettle(req, res) {
  res.json(await debts.settle(req.userId, req.params.id, parseSettle(req.body)));
}
