import { pool } from '../config/db.js';

/**
 * @typedef {object} UserRecord
 * @property {string} id Identificador UUID.
 * @property {string} email Correo en minúsculas.
 * @property {string} passwordHash Hash bcrypt de la contraseña (nunca sale de la API).
 * @property {string} timezone Zona horaria del usuario.
 */

const USER_COLUMNS = 'id, email, password_hash AS "passwordHash", timezone';

/**
 * Crea un usuario. Si el correo ya existe no inserta nada.
 * @param {{ email: string, passwordHash: string }} data
 * @returns {Promise<UserRecord|null>} El usuario creado, o `null` si el correo ya estaba registrado.
 */
export async function createUser({ email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [email, passwordHash],
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
