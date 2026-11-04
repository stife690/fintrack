import { accountService } from '../services/account.service.js';
import { pushService } from '../services/push.service.js';
import { getProfile, updateProfile } from '../services/users.service.js';
import { parseReminderSettings } from '../validators/push.validator.js';
import { parseDeleteAccount, parseUpdateProfile } from '../validators/users.validator.js';

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
 * `PATCH /api/v1/users/me`: cambia el nombre visible del usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function patchMe(req, res) {
  res.json(await updateProfile(req.userId, parseUpdateProfile(req.body)));
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

/**
 * `DELETE /api/v1/users/me`: elimina la cuenta y todos sus datos (FT-0017). Pide confirmar con la
 * contraseña o con Google. Responde 204 sin cuerpo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteMe(req, res) {
  await accountService.remove(req.userId, parseDeleteAccount(req.body));
  res.status(204).end();
}
