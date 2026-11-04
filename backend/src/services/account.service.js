import bcrypt from 'bcryptjs';
import { AppError } from '../errors/app-error.js';
import { deleteAccount as deleteAccountRows } from '../repositories/account.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { attachments } from './attachments.service.js';
import { googleVerifier } from './google-auth.service.js';
import { sendAccountDeletedEmail } from './mail.service.js';

/**
 * 403 y no 401: el token sí es válido, lo que falla es la confirmación. Con 401 la app intentaría
 * renovar la sesión y, al fallar, la cerraría.
 * @param {string} message
 * @returns {AppError}
 */
function notConfirmed(message) {
  return new AppError(403, 'CONFIRMATION_FAILED', message);
}

/**
 * Eliminar la cuenta (FT-0017).
 * @param {object} [deps] Dependencias reemplazables en las pruebas.
 * @param {{ verify: (credential: string) => Promise<{ email: string }> }} [deps.verifier]
 * @param {(userId: string) => Promise<{ email: string, attachmentKeys: string[] }|null>} [deps.deleteRows]
 * @param {(keys: string[]) => Promise<void>} [deps.removeFiles]
 * @param {(mail: { to: string }) => Promise<void>} [deps.sendEmail]
 * @returns {{ remove: (userId: string, confirmation: { password?: string, googleCredential?: string }) => Promise<void> }}
 */
export function createAccountService(deps = {}) {
  const verifier = deps.verifier ?? googleVerifier;
  const deleteRows = deps.deleteRows ?? deleteAccountRows;
  const removeFiles = deps.removeFiles ?? attachments.removeFiles;
  const sendEmail = deps.sendEmail ?? sendAccountDeletedEmail;

  /**
   * ¿Es el dueño quien lo pide? Se vuelve a pedir la contraseña, o entrar otra vez con Google para
   * las cuentas creadas así (su contraseña es aleatoria y nadie la sabe). Así un celular que quedó
   * con la sesión abierta no basta para borrar la cuenta.
   * @param {{ email: string, passwordHash: string }} user
   * @param {{ password?: string, googleCredential?: string }} confirmation
   * @returns {Promise<void>}
   * @throws {AppError} 403 `CONFIRMATION_FAILED` si no coincide.
   */
  async function confirmOwner(user, { password, googleCredential }) {
    if (password !== undefined) {
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw notConfirmed('La contraseña no es correcta');
      }
      return;
    }
    let google;
    try {
      google = await verifier.verify(googleCredential);
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 503) throw err; // Google no configurado
      throw notConfirmed('No pudimos confirmar tu cuenta de Google');
    }
    if (google.email !== user.email.toLowerCase()) {
      throw notConfirmed('Esa cuenta de Google no es la de esta cuenta de FinTrack');
    }
  }

  return {
    /**
     * Borra la cuenta y todos sus datos, luego los archivos de sus soportes y avisa por correo.
     * Si fallan los archivos o el correo, la cuenta igual queda borrada (el error va al log).
     * @param {string} userId
     * @param {{ password?: string, googleCredential?: string }} confirmation Ya validada: trae una de las dos.
     * @returns {Promise<void>}
     * @throws {AppError} 401 si la cuenta ya no existe; 403 si la confirmación no coincide.
     */
    async remove(userId, confirmation) {
      const user = await findUserById(userId);
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
      await confirmOwner(user, confirmation);

      const deleted = await deleteRows(userId);
      if (!deleted) throw new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
      await removeFiles(deleted.attachmentKeys);
      await sendEmail({ to: deleted.email }).catch((err) => {
        console.error(`No se envió el aviso de cuenta eliminada (${err.message})`);
      });
    },
  };
}

export const accountService = createAccountService();
