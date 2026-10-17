import {
  parseCreateTransaction,
  parseListQuery,
  parseUpdateTransaction,
} from '../validators/transactions.validator.js';
import { getTransactionAlert } from '../services/budgets.service.js';
import * as transactions from '../services/transactions.service.js';

/*
 * El contrato (§3) envuelve la respuesta de POST y PUT como `{ transaction, alert }`.
 * `alert` es el estado del presupuesto de la categoría y el mes de la transacción (F5),
 * o `null` si no es un gasto, no tiene categoría o esa categoría no tiene presupuesto.
 */

/**
 * `POST /api/v1/transactions`: registra una transacción (categoría opcional → IA).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postTransaction(req, res) {
  const input = parseCreateTransaction(req.body);
  const transaction = await transactions.create(req.userId, input);
  res.status(201).json({ transaction, alert: await getTransactionAlert(req.userId, transaction) });
}
/**
 * `GET /api/v1/transactions`: lista paginada con filtros, de la más reciente a la más antigua.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getTransactions(req, res) {
  res.json(await transactions.list(req.userId, parseListQuery(req.query)));
}

/**
 * `GET /api/v1/transactions/:id`: una transacción propia (para abrir la edición sin el listado).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getTransaction(req, res) {
  res.json(await transactions.get(req.userId, req.params.id));
}

/**
 * `PUT /api/v1/transactions/:id`: modifica una transacción propia.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putTransaction(req, res) {
  const changes = parseUpdateTransaction(req.body);
  const transaction = await transactions.update(req.userId, req.params.id, changes);
  res.json({ transaction, alert: await getTransactionAlert(req.userId, transaction) });
}

/**
 * `DELETE /api/v1/transactions/:id`: borrado lógico de una transacción propia.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteTransaction(req, res) {
  await transactions.remove(req.userId, req.params.id);
  res.status(204).end();
}
