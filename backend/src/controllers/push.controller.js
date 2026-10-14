import { pushService } from '../services/push.service.js';
import { parseSubscribeBody, parseUnsubscribeBody } from '../validators/push.validator.js';

/**
 * `GET /api/v1/push/vapid-public-key`: llave pública VAPID para `PushManager.subscribe()`.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {void}
 */
export function getVapidPublicKey(_req, res) {
  res.json(pushService.getVapidPublicKey());
}

/**
 * `POST /api/v1/push/subscribe`: registra la suscripción push del navegador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function subscribe(req, res) {
  await pushService.subscribe(req.userId, parseSubscribeBody(req.body));
  res.status(201).end();
}

/**
 * `DELETE /api/v1/push/subscribe`: elimina la suscripción (el usuario desactivó las notificaciones).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function unsubscribe(req, res) {
  await pushService.unsubscribe(req.userId, parseUnsubscribeBody(req.body));
  res.status(204).end();
}
