import { pool } from './config/db.js';
import { login, register } from './services/auth.service.js';

/**
 * Solo para pruebas: crea una cuenta con el correo ya verificado y le abre sesión. Desde FT-0016
 * el registro no da sesión hasta abrir el enlace del correo; las pruebas que solo necesitan un
 * usuario con sesión usan esto en vez de `POST /auth/register`. Devuelve la misma forma que
 * respondía el registro antes.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ user: { id: string, email: string, name: string|null }, accessToken: string, refreshToken: string }>}
 */
export async function createVerifiedSession({ email, password }) {
  await register({ email, password }, async () => {});
  await pool.query('UPDATE usuarios SET email_verificado_at = now() WHERE email = $1', [
    email.trim().toLowerCase(),
  ]);
  return login({ email, password });
}
