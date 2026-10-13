import {
  parseCreateTransaction,
  parseListQuery,
  parseUpdateTransaction,
} from '../validators/transactions.validator.js';
import * as transactions from '../services/transactions.service.js';

/**
 * `POST /api/v1/transactions`: registra una transacción (categoría opcional → IA).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postTransaction(req, res) {
  const input = parseCreateTransaction(req.body);
  res.status(201).json(await transactions.create(req.userId, input));
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
 * `PUT /api/v1/transactions/:id`: modifica una transacción propia.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putTransaction(req, res) {
  const changes = parseUpdateTransaction(req.body);
  res.json(await transactions.update(req.userId, req.params.id, changes));
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
