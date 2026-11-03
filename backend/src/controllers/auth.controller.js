import {
  login,
  loginWithGoogle,
  logout,
  refresh,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '../services/auth.service.js';
import {
  parseCredentials,
  parseForgotPassword,
  parseGoogleCredential,
  parseNewCredentials,
  parseRefreshToken,
  parseResendVerification,
  parseResetPassword,
  parseVerifyEmail,
} from '../validators/auth.validator.js';

/**
 * `POST /api/v1/auth/register`: crea la cuenta, envía el correo de verificación y responde 201
 * sin sesión (FT-0016).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postRegister(req, res) {
  const result = await register(parseNewCredentials(req.body));
  res.status(201).json(result);
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
 * `POST /api/v1/auth/google`: inicia sesión (o crea la cuenta) con el `credential` de Google.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postGoogle(req, res) {
  const session = await loginWithGoogle(parseGoogleCredential(req.body));
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

/**
 * `POST /api/v1/auth/logout`: revoca el refresh token de la sesión y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postLogout(req, res) {
  await logout({ userId: req.userId, refreshToken: parseRefreshToken(req.body) });
  res.status(204).end();
}

/**
 * `POST /api/v1/auth/forgot-password`: si el correo tiene cuenta, le envía un enlace para crear
 * una contraseña nueva. Responde 200 con el mismo mensaje exista o no la cuenta.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postForgotPassword(req, res) {
  await requestPasswordReset(parseForgotPassword(req.body));
  res.json({
    message: 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.',
  });
}

/**
 * `POST /api/v1/auth/reset-password`: cambia la contraseña con el token del enlace y cierra
 * todas las sesiones. Responde 204 sin cuerpo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postResetPassword(req, res) {
  await resetPassword(parseResetPassword(req.body));
  res.status(204).end();
}

/**
 * `POST /api/v1/auth/verify-email`: verifica el correo con el token del enlace y responde 200
 * con la sesión (FT-0016).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postVerifyEmail(req, res) {
  const session = await verifyEmail(parseVerifyEmail(req.body));
  res.json(session);
}

/**
 * `POST /api/v1/auth/resend-verification`: si el correo tiene una cuenta sin verificar, le envía
 * otro enlace. Responde 200 con el mismo mensaje en cualquier caso.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postResendVerification(req, res) {
  await resendVerification(parseResendVerification(req.body));
  res.json({
    message: 'Si el correo tiene una cuenta sin confirmar, te enviamos un enlace nuevo.',
  });
}
