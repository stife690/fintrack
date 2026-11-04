import { notifications } from '../services/notifications.service.js';

/**
 * `GET /api/v1/notifications`: los avisos más recientes y cuántos no ha leído (FT-0045).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getNotifications(req, res) {
  res.json(await notifications.list(req.userId));
}

/**
 * `POST /api/v1/notifications/read`: marca todos como leídos. Responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postRead(req, res) {
  await notifications.markAllRead(req.userId);
  res.status(204).end();
}
