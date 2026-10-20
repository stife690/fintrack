import { AppError } from '../errors/app-error.js';
import { findUserById, updateUserName } from '../repositories/users.repository.js';

/**
 * @typedef {object} Profile
 * @property {string} id
 * @property {string} email
 * @property {string|null} name Nombre visible; `null` si no lo ha puesto.
 * @property {string} timezone
 */

/**
 * Perfil público a partir del registro de la base (sin el hash de la contraseña).
 * @param {import('../repositories/users.repository.js').UserRecord} user
 * @returns {Profile}
 */
function toProfile(user) {
  return { id: user.id, email: user.email, name: user.name, timezone: user.timezone };
}

/** @returns {AppError} 401: el token es válido pero la cuenta ya no existe. */
function accountGone() {
  return new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
}

/**
 * Devuelve el perfil público del usuario autenticado.
 * @param {string} userId
 * @returns {Promise<Profile>}
 */
export async function getProfile(userId) {
  const user = await findUserById(userId);
  if (!user) throw accountGone();
  return toProfile(user);
}

/**
 * Cambia el nombre visible del usuario autenticado.
 * @param {string} userId
 * @param {{ name: string|null }} changes Datos ya validados.
 * @returns {Promise<Profile>}
 */
export async function updateProfile(userId, { name }) {
  const user = await updateUserName(userId, name);
  if (!user) throw accountGone();
  return toProfile(user);
}
