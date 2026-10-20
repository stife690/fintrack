import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

/**
 * @typedef {object} GoogleProfile
 * @property {string} email Correo de la cuenta de Google, en minúsculas.
 * @property {string|null} name Nombre que Google muestra para la cuenta.
 */

/**
 * Crea el verificador de tokens de Google. Comprueba la firma del `id_token` contra los
 * certificados de Google, que el token sea para este cliente (`GOOGLE_CLIENT_ID`), que no haya
 * vencido y que el correo esté verificado. El secreto de cliente no se necesita.
 *
 * @param {object} [deps]
 * @param {string|undefined} [deps.clientId] ID de cliente OAuth (por defecto `GOOGLE_CLIENT_ID`).
 * @param {{ verifyIdToken: (options: { idToken: string, audience: string }) => Promise<{ getPayload: () => (object|undefined) }> }} [deps.client]
 * @returns {{ verify: (credential: string) => Promise<GoogleProfile> }}
 */
export function createGoogleVerifier(deps = {}) {
  const clientId = 'clientId' in deps ? deps.clientId : env.googleClientId;
  const client = deps.client ?? new OAuth2Client();

  return {
    /**
     * @param {string} credential `id_token` (JWT) que entrega Google Identity Services.
     * @returns {Promise<GoogleProfile>}
     * @throws {AppError} 503 si el servidor no tiene `GOOGLE_CLIENT_ID`; 401 si el token no es válido.
     */
    async verify(credential) {
      if (!clientId) {
        throw new AppError(
          503,
          'GOOGLE_NOT_CONFIGURED',
          'El inicio de sesión con Google no está disponible',
        );
      }
      let payload;
      try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        payload = ticket.getPayload();
      } catch {
        throw new AppError(401, 'UNAUTHORIZED', 'No pudimos verificar tu cuenta de Google');
      }
      if (!payload?.email || payload.email_verified !== true) {
        throw new AppError(
          401,
          'UNAUTHORIZED',
          'Tu cuenta de Google no tiene el correo verificado',
        );
      }
      return { email: payload.email.trim().toLowerCase(), name: payload.name?.trim() || null };
    },
  };
}

/** Verificador con la configuración real. */
export const googleVerifier = createGoogleVerifier();
