import { pool } from '../config/db.js';

/**
 * @typedef {object} UserRecord
 * @property {string} id Identificador UUID.
 * @property {string} email Correo en minúsculas.
 * @property {string|null} name Nombre visible; `null` si el usuario no lo ha puesto.
 * @property {string} passwordHash Hash bcrypt de la contraseña (nunca sale de la API).
 * @property {string} timezone Zona horaria del usuario.
 */

const USER_COLUMNS = 'id, email, nombre AS name, password_hash AS "passwordHash", timezone';

/**
 * Crea un usuario. Si el correo ya existe no inserta nada.
 * @param {{ email: string, passwordHash: string, name?: string|null }} data
 * @returns {Promise<UserRecord|null>} El usuario creado, o `null` si el correo ya estaba registrado.
 */
export async function createUser({ email, passwordHash, name = null }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [email, passwordHash, name],
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
