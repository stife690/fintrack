import { isAdminEmail } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { findUserById } from '../repositories/users.repository.js';

/**
 * Exige que el usuario esté en `ADMIN_EMAILS`. Va después de `requireAuth`. El correo se consulta
 * en la base en cada petición: el token solo trae el id y quitar a alguien de la lista surte
 * efecto de una vez.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 * @throws {AppError} 403 si no es administrador.
 */
export async function requireAdmin(req, _res, next) {
  const user = await findUserById(req.userId);
  if (!user || !isAdminEmail(user.email)) {
    throw new AppError(403, 'FORBIDDEN', 'No tienes permiso para esta acción');
  }
  next();
}
