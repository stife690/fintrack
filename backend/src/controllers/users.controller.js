import { getProfile } from '../services/users.service.js';

/**
 * `GET /api/v1/users/me`: perfil del usuario dueño del token.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getMe(req, res) {
  res.json(await getProfile(req.userId));
}
