import { login, refresh, register } from '../services/auth.service.js';
import {
  parseCredentials,
  parseNewCredentials,
  parseRefreshToken,
} from '../validators/auth.validator.js';

/**
 * `POST /api/v1/auth/register`: crea la cuenta y responde 201 con la sesión.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postRegister(req, res) {
  const session = await register(parseNewCredentials(req.body));
  res.status(201).json(session);
}

/**
 * `POST /api/v1/auth/login`: responde 200 con la sesión.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postLogin(req, res) {
  const session = await login(parseCredentials(req.body));
  res.json(session);
}

/**
 * `POST /api/v1/auth/refresh`: cambia un refresh token por un par nuevo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postRefresh(req, res) {
  const tokens = await refresh(parseRefreshToken(req.body));
  res.json(tokens);
}
