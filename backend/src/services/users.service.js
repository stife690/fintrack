import { AppError } from '../errors/app-error.js';
import { findUserById } from '../repositories/users.repository.js';

/**
 * Devuelve el perfil público del usuario autenticado.
 * @param {string} userId
 * @returns {Promise<{ id: string, email: string, timezone: string }>}
 */
export async function getProfile(userId) {
  const user = await findUserById(userId);
  if (!user) {
    // El token es válido pero la cuenta ya no existe.
    throw new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
  }
  return { id: user.id, email: user.email, timezone: user.timezone };
}
