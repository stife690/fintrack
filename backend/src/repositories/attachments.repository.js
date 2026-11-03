import { pool } from '../config/db.js';

/**
 * @typedef {object} AttachmentRecord
 * @property {string} id UUID del soporte.
 * @property {string} transactionId Movimiento al que pertenece.
 * @property {string} name Nombre original del archivo, solo para mostrarlo.
 * @property {'image/jpeg'|'image/png'|'image/webp'|'application/pdf'} type Tipo real, según sus primeros bytes.
 * @property {number} size Bytes.
 * @property {string} key Dónde está el archivo en el almacenamiento.
 * @property {Date} createdAt Cuándo se subió.
 */

const COLUMNS = `id, transaccion_id AS "transactionId", nombre AS name, tipo AS type,
  tamano AS size, ruta AS key, created_at AS "createdAt"`;

/**
 * Guarda un soporte si el movimiento es del usuario, no está borrado y aún no tiene `max`
 * soportes. Todo en una sentencia, para que dos subidas al tiempo no pasen del límite.
 * @param {{ transactionId: string, userId: string, name: string, type: string, size: number, key: string, max: number }} data
 * @returns {Promise<AttachmentRecord|null>} `null` si el movimiento no existe o ya tiene el máximo.
 */
export async function insertAttachment({ transactionId, userId, name, type, size, key, max }) {
  const { rows } = await pool.query(
    `INSERT INTO transaccion_soportes (transaccion_id, usuario_id, nombre, tipo, tamano, ruta)
     SELECT t.id, t.usuario_id, $3, $4, $5, $6 FROM transacciones t
     WHERE t.id = $1 AND t.usuario_id = $2 AND t.deleted_at IS NULL
       AND (SELECT count(*) FROM transaccion_soportes s WHERE s.transaccion_id = t.id) < $7
     RETURNING ${COLUMNS}`,
    [transactionId, userId, name, type, size, key, max],
  );
  return rows[0] ?? null;
}

/**
 * Soportes de un movimiento del usuario, del más antiguo al más reciente.
 * @param {string} transactionId
 * @param {string} userId
 * @returns {Promise<AttachmentRecord[]>}
 */
export async function listAttachments(transactionId, userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM transaccion_soportes
     WHERE transaccion_id = $1 AND usuario_id = $2 ORDER BY created_at, id`,
    [transactionId, userId],
  );
  return rows;
}

/**
 * Un soporte del usuario, de ese movimiento (si no es suyo, no lo revela).
 * @param {string} id
 * @param {string} transactionId
 * @param {string} userId
 * @returns {Promise<AttachmentRecord|null>}
 */
export async function findAttachment(id, transactionId, userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM transaccion_soportes
     WHERE id = $1 AND transaccion_id = $2 AND usuario_id = $3`,
    [id, transactionId, userId],
  );
  return rows[0] ?? null;
}

/**
 * Borra un soporte del usuario.
 * @param {string} id
 * @param {string} transactionId
 * @param {string} userId
 * @returns {Promise<string|null>} Dónde estaba el archivo, o `null` si no existía.
 */
export async function deleteAttachment(id, transactionId, userId) {
  const { rows } = await pool.query(
    `DELETE FROM transaccion_soportes WHERE id = $1 AND transaccion_id = $2 AND usuario_id = $3
     RETURNING ruta AS key`,
    [id, transactionId, userId],
  );
  return rows[0]?.key ?? null;
}

/**
 * Borra todos los soportes de un movimiento del usuario (al eliminar el movimiento).
 * @param {string} transactionId
 * @param {string} userId
 * @returns {Promise<string[]>} Dónde estaban los archivos.
 */
export async function deleteAttachmentsOf(transactionId, userId) {
  const { rows } = await pool.query(
    `DELETE FROM transaccion_soportes WHERE transaccion_id = $1 AND usuario_id = $2
     RETURNING ruta AS key`,
    [transactionId, userId],
  );
  return rows.map((r) => r.key);
}
