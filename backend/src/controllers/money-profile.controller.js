import * as moneyProfile from '../services/money-profile.service.js';
import { parseCommitment, parseProfile, parseWelcome } from '../validators/money-profile.validator.js';

/**
 * `GET /api/v1/money-profile`: perfil del usuario con sus compromisos.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getProfile(req, res) {
  res.json(await moneyProfile.get(req.userId));
}

/**
 * `PUT /api/v1/money-profile`: cambia cómo le entra la plata y cuánta tiene.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putProfile(req, res) {
  res.json(await moneyProfile.update(req.userId, parseProfile(req.body)));
}

/**
 * `POST /api/v1/money-profile/welcome`: guarda la bienvenida; sin datos, la marca como omitida.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postWelcome(req, res) {
  res.json(await moneyProfile.finishWelcome(req.userId, parseWelcome(req.body)));
}

/**
 * `POST /api/v1/money-profile/commitments`: crea un compromiso y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postCommitment(req, res) {
  res.status(201).json(await moneyProfile.createCommitment(req.userId, parseCommitment(req.body)));
}

/**
 * `PUT /api/v1/money-profile/commitments/:id`: cambia un compromiso.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putCommitment(req, res) {
  res.json(await moneyProfile.updateCommitment(req.userId, req.params.id, parseCommitment(req.body)));
}

/**
 * `DELETE /api/v1/money-profile/commitments/:id`: elimina un compromiso y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteCommitment(req, res) {
  await moneyProfile.removeCommitment(req.userId, req.params.id);
  res.status(204).end();
}
