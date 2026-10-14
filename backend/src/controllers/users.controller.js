import { pushService } from '../services/push.service.js';
import { getProfile } from '../services/users.service.js';
import { parseReminderSettings } from '../validators/push.validator.js';

/**
 * `GET /api/v1/users/me`: perfil del usuario dueño del token.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getMe(req, res) {
  res.json(await getProfile(req.userId));
}

/**
 * `GET /api/v1/users/me/reminder-settings`: hora y zona horaria del recordatorio diario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getReminderSettings(req, res) {
  res.json(await pushService.getReminderSettings(req.userId));
}

/**
 * `PUT /api/v1/users/me/reminder-settings`: configura el recordatorio diario (REQ-030).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putReminderSettings(req, res) {
  res.json(await pushService.updateReminderSettings(req.userId, parseReminderSettings(req.body)));
}
