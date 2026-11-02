/**
 * Perfil del usuario, según `docs/api/openapi.yaml` (`/users/me`).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} Profile
 * @property {string} id
 * @property {string} email
 * @property {string|null} name Nombre visible; `null` si no lo ha puesto.
 * @property {string} timezone
 * @property {boolean} isAdmin Si administra Lo que viene.
 */

/** Largo máximo del nombre (igual que `usuarios.nombre` en la base). */
export const MAX_NAME_LENGTH = 60;

/** @returns {Promise<Profile>} */
export function getProfile() {
  return apiRequest('/users/me');
}

/**
 * Cambia el nombre visible. `null` o un texto vacío lo borran.
 * @param {string|null} name
 * @returns {Promise<Profile>}
 */
export function updateProfile(name) {
  return apiRequest('/users/me', { method: 'PATCH', body: { name } });
}
