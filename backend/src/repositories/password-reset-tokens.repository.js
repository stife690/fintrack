import { pool } from '../config/db.js';

/**
 * Guarda el hash de un enlace para recuperar la contraseña recién enviado. En la misma sentencia
 * anula los enlaces anteriores del usuario que no se usaron: solo sirve el último que llegó.
 * @param {{ userId: string, tokenHash: string, expiresAt: Date }} data
 * @returns {Promise<void>}
 */
export async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  await pool.query(
    `WITH anulados AS (
       UPDATE password_reset_tokens
       SET used_at = now()
       WHERE usuario_id = $1 AND used_at IS NULL
     )
     INSERT INTO password_reset_tokens (usuario_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

/**
 * Cambia la contraseña con un enlace de recuperación, todo en una sola sentencia (o pasa todo o
 * nada): gasta el enlace si es válido (existe, no se usó y no venció), guarda el hash nuevo y
 * revoca los refresh tokens del usuario, lo que cierra la sesión en los demás dispositivos.
 * @param {{ tokenHash: string, passwordHash: string }} data
 * @returns {Promise<string|null>} Id del usuario, o `null` si el enlace no es válido.
 */
export async function resetPasswordWithToken({ tokenHash, passwordHash }) {
  const { rows } = await pool.query(
    `WITH enlace AS (
       UPDATE password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING usuario_id
     ),
     usuario AS (
       UPDATE usuarios
       SET password_hash = $2
       WHERE id = (SELECT usuario_id FROM enlace)
       RETURNING id
     ),
     sesiones AS (
       UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE usuario_id = (SELECT id FROM usuario) AND revoked_at IS NULL
     )
     SELECT id AS "userId" FROM usuario`,
    [tokenHash, passwordHash],
  );
  return rows[0]?.userId ?? null;
}
