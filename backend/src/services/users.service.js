import { isAdminEmail } from '../config/env.js';
import { LEGAL_VERSION } from '../config/legal.js';
import { AppError } from '../errors/app-error.js';
import { acceptTerms, findUserById, updateUserName } from '../repositories/users.repository.js';

/**
 * @typedef {object} Profile
 * @property {string} id
 * @property {string} email
 * @property {string|null} name Nombre visible; `null` si no lo ha puesto.
 * @property {string} timezone
 * @property {boolean} termsAccepted Si aceptó la versión vigente de los términos y la privacidad.
 */

/**
 * Perfil público a partir del registro de la base (sin el hash de la contraseña).
 * @param {import('../repositories/users.repository.js').UserRecord} user
 * @returns {Profile}
 */
function toProfile(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    isAdmin: isAdminEmail(user.email),
    termsAccepted: user.termsVersion === LEGAL_VERSION,
  };
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

/**
 * Guarda que el usuario aceptó los términos y la política de privacidad (FT-0017). Solo vale la
 * versión vigente: si la app trae una vieja (estaba abierta cuando se publicó otra), se rechaza y
 * la persona ve el texto nuevo antes de aceptar.
 * @param {string} userId
 * @param {string} version Ya validada como texto.
 * @returns {Promise<Profile>}
 */
export async function acceptCurrentTerms(userId, version) {
  if (version !== LEGAL_VERSION) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'version', problem: 'No es la versión vigente de los términos; recarga la página' },
    ]);
  }
  const user = await acceptTerms(userId, version);
  if (!user) throw accountGone();
  return toProfile(user);
}
