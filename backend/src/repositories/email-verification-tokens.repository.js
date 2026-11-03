import { pool } from '../config/db.js';

/**
 * Guarda el hash de un enlace de verificación recién enviado (FT-0016). En la misma sentencia
 * anula los enlaces anteriores del usuario que no se usaron: solo sirve el último que llegó.
 * @param {{ userId: string, tokenHash: string, expiresAt: Date }} data
 * @returns {Promise<void>}
 */
export async function createEmailVerificationToken({ userId, tokenHash, expiresAt }) {
  await pool.query(
    `WITH anulados AS (
       UPDATE email_verification_tokens
       SET used_at = now()
       WHERE usuario_id = $1 AND used_at IS NULL
     )
     INSERT INTO email_verification_tokens (usuario_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

/**
 * Verifica el correo con el enlace, todo en una sola sentencia: gasta el enlace si es válido
 * (existe, no se usó y no venció) y marca la cuenta como verificada. Si ya lo estaba, conserva
 * la fecha de la primera vez.
 * @param {string} tokenHash
 * @returns {Promise<string|null>} Id del usuario, o `null` si el enlace no es válido.
 */
export async function verifyEmailWithToken(tokenHash) {
  const { rows } = await pool.query(
    `WITH enlace AS (
       UPDATE email_verification_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING usuario_id
     )
     UPDATE usuarios
     SET email_verificado_at = COALESCE(email_verificado_at, now())
     WHERE id = (SELECT usuario_id FROM enlace)
     RETURNING id AS "userId"`,
    [tokenHash],
  );
  return rows[0]?.userId ?? null;
}
