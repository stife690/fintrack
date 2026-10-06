import { AppError } from '../errors/app-error.js';
import { verifyAccessToken } from '../services/token.service.js';

/**
 * Exige un access token válido en `Authorization: Bearer <token>`.
 * Si es válido deja el id del usuario en `req.userId`; si no, responde 401
 * (`TOKEN_EXPIRED` si venció, `UNAUTHORIZED` en cualquier otro caso).
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('Authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
  }

  try {
    req.userId = verifyAccessToken(token).sub;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError(401, 'TOKEN_EXPIRED', 'El token expiró');
    }
    throw new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
  }

  next();
}
