import * as cards from '../services/cards.service.js';
import {
  parseCardChanges,
  parseNewCard,
  parsePayment,
  parseSync,
} from '../validators/cards.validator.js';

/** `GET /api/v1/cards`: tarjetas del usuario con su estado. */
export async function getCards(req, res) {
  res.json(await cards.list(req.userId));
}

/** `GET /api/v1/cards/:id`. */
export async function getCard(req, res) {
  res.json(await cards.get(req.userId, req.params.id));
}

/** `POST /api/v1/cards`: crea la tarjeta y responde 201. */
export async function postCard(req, res) {
  res.status(201).json(await cards.create(req.userId, parseNewCard(req.body)));
}

/** `PUT /api/v1/cards/:id`: edita la tarjeta. */
export async function putCard(req, res) {
  res.json(await cards.update(req.userId, req.params.id, parseCardChanges(req.body)));
}

/** `DELETE /api/v1/cards/:id`: borrado lógico. */
export async function deleteCard(req, res) {
  await cards.remove(req.userId, req.params.id);
  res.status(204).end();
}

/** `POST /api/v1/cards/:id/payments`: registra un pago y responde 201. */
export async function postPayment(req, res) {
  res.status(201).json(await cards.pay(req.userId, req.params.id, parsePayment(req.body)));
}

/** `DELETE /api/v1/cards/:id/payments/:paymentId`. */
export async function deletePayment(req, res) {
  await cards.removePayment(req.userId, req.params.id, req.params.paymentId);
  res.status(204).end();
}

/** `POST /api/v1/cards/:id/sync-with-bank`: ajusta a lo que dice el banco. */
export async function postSyncWithBank(req, res) {
  res.json(await cards.syncWithBank(req.userId, req.params.id, parseSync(req.body)));
}

/** `GET /api/v1/cards/:id/movements`. */
export async function getMovements(req, res) {
  res.json(await cards.movements(req.userId, req.params.id));
}
