import { pool } from '../config/db.js';

/**
 * @typedef {object} UserRecord
 * @property {string} id Identificador UUID.
 * @property {string} email Correo en minúsculas.
 * @property {string|null} name Nombre visible; `null` si el usuario no lo ha puesto.
 * @property {string} passwordHash Hash bcrypt de la contraseña (nunca sale de la API).
 * @property {string} timezone Zona horaria del usuario.
 * @property {boolean} emailVerified Si ya abrió el enlace del correo de verificación (FT-0016).
 * @property {string|null} termsVersion Versión de los términos y la privacidad que aceptó (FT-0017).
 */

const USER_COLUMNS = `id, email, nombre AS name, password_hash AS "passwordHash", timezone,
  email_verificado_at IS NOT NULL AS "emailVerified", terminos_version AS "termsVersion"`;

/**
 * Crea un usuario. Si el correo ya existe no inserta nada.
 * @param {{ email: string, passwordHash: string, name?: string|null, verified?: boolean, termsVersion?: string|null }} data
 *   `verified`: la cuenta nace con el correo verificado (entrar con Google ya lo demuestra).
 *   `termsVersion`: versión de los términos que aceptó al crearla; se guarda con la fecha (FT-0017).
 * @returns {Promise<UserRecord|null>} El usuario creado, o `null` si el correo ya estaba registrado.
 */
export async function createUser({
  email,
  passwordHash,
  name = null,
  verified = false,
  termsVersion = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios
       (email, password_hash, nombre, email_verificado_at, terminos_version, terminos_aceptados_at)
     VALUES ($1, $2, $3, CASE WHEN $4 THEN now() END, $5::varchar, CASE WHEN $5 IS NOT NULL THEN now() END)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [email, passwordHash, name, verified, termsVersion],
  );
  return rows[0] ?? null;
}

/**
 * Busca un usuario por correo.
 * @param {string} email
 * @returns {Promise<UserRecord|null>}
 */
export async function findUserByEmail(email) {
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM usuarios WHERE email = $1`, [
    email,
  ]);
  return rows[0] ?? null;
}

/**
 * Busca un usuario por id.
 * @param {string} id
 * @returns {Promise<UserRecord|null>}
 */
export async function findUserById(id) {
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Cambia el nombre visible de un usuario.
 * @param {string} id
 * @param {string|null} name Nombre ya validado; `null` lo borra.
 * @returns {Promise<UserRecord|null>} El usuario actualizado, o `null` si no existe.
 */
export async function updateUserName(id, name) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET nombre = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, name],
  );
  return rows[0] ?? null;
}

/**
 * Una cuenta sin verificar pasa a quien demostró que el correo es suyo (entró con Google). En una
 * sola sentencia: la marca verificada, cambia la contraseña por una que nadie conoce y revoca los
 * refresh tokens. Así, si otra persona la registró con ese correo, su contraseña deja de servir.
 * @param {{ id: string, passwordHash: string }} data `passwordHash`: hash de una cadena aleatoria.
 * @returns {Promise<UserRecord|null>} El usuario actualizado, o `null` si ya estaba verificado.
 */
export async function claimUnverifiedAccount({ id, passwordHash }) {
  const { rows } = await pool.query(
    `WITH usuario AS (
       UPDATE usuarios
       SET email_verificado_at = now(), password_hash = $2
       WHERE id = $1 AND email_verificado_at IS NULL
       RETURNING ${USER_COLUMNS}
     ),
     sesiones AS (
       UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE usuario_id = (SELECT id FROM usuario) AND revoked_at IS NULL
     )
     SELECT * FROM usuario`,
    [id, passwordHash],
  );
  return rows[0] ?? null;
}

/**
 * Guarda que el usuario aceptó una versión de los términos y la privacidad, con la fecha de hoy.
 * @param {string} id
 * @param {string} version
 * @returns {Promise<UserRecord|null>} El usuario actualizado, o `null` si no existe.
 */
export async function acceptTerms(id, version) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET terminos_version = $2, terminos_aceptados_at = now()
     WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, version],
  );
  return rows[0] ?? null;
}
