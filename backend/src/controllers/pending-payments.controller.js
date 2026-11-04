import { pendingPayments } from '../services/pending-payments.service.js';
import { parseConfirm, parseIncomingPayment } from '../validators/pending-payments.validator.js';

/**
 * `GET /api/v1/pending-payments/token`: si la función está activa y si ya hay token (sin mostrarlo).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getToken(req, res) {
  res.json(await pendingPayments.getToken(req.userId));
}

/**
 * `POST /api/v1/pending-payments/token`: crea un token nuevo (el anterior deja de servir).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postToken(req, res) {
  res.status(201).json(await pendingPayments.createToken(req.userId));
}

/**
 * `DELETE /api/v1/pending-payments/token`: revoca el token.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteToken(req, res) {
  await pendingPayments.revokeToken(req.userId);
  res.status(204).end();
}

/**
 * `GET /api/v1/pending-payments`: pagos que esperan confirmación.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getPending(req, res) {
  res.json(await pendingPayments.list(req.userId));
}

/**
 * `POST /api/v1/pending-payments/:id/confirm`: crea el gasto.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postConfirm(req, res) {
  res.json(await pendingPayments.confirm(req.userId, req.params.id, parseConfirm(req.body)));
}

/**
 * `POST /api/v1/pending-payments/:id/discard`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postDiscard(req, res) {
  res.json(await pendingPayments.discard(req.userId, req.params.id));
}

/**
 * `POST /api/v1/shortcuts/payments`: lo llama el Atajo del iPhone con su token personal.
 * Responde 201 si es nuevo y 200 si ya había llegado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postShortcutPayment(req, res) {
  const [scheme, token] = (req.get('Authorization') ?? '').split(' ');
  const owner = await pendingPayments.authenticate(scheme === 'Bearer' ? token : undefined);
  const result = await pendingPayments.receive(owner, parseIncomingPayment(req.body));
  res.status(result.duplicate ? 200 : 201).json(result);
}
