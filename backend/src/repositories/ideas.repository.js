import { pool } from '../config/db.js';

/**
 * @typedef {object} PublishedIdea
 * @property {string} id
 * @property {string} title
 * @property {'planeada'|'en_progreso'|'lista'} status
 * @property {number} votes
 * @property {boolean} voted `true` si el usuario ya votó por ella.
 */

/**
 * Ideas públicas con sus votos, de la más votada a la menos. No incluye quién las envió.
 * @param {string} userId Para saber por cuáles votó.
 * @returns {Promise<PublishedIdea[]>}
 */
export async function listPublished(userId) {
  const { rows } = await pool.query(
    `SELECT i.id, i.titulo AS title, i.estado AS status, count(v.usuario_id)::int AS votes,
            COALESCE(bool_or(v.usuario_id = $1), false) AS voted
     FROM ideas i LEFT JOIN idea_votos v ON v.idea_id = i.id
     WHERE i.estado IN ('planeada','en_progreso','lista')
     GROUP BY i.id
     ORDER BY votes DESC, i.updated_at DESC`,
    [userId],
  );
  return rows;
}

/**
 * Cuántas ideas envió el usuario en las últimas 24 horas.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countRecent(userId) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total FROM ideas
     WHERE usuario_id = $1 AND created_at > now() - interval '1 day'`,
    [userId],
  );
  return rows[0].total;
}

/**
 * Guarda una idea en revisión.
 * @param {string} userId
 * @param {string} title
 * @returns {Promise<{ id: string, title: string, status: 'revision' }>}
 */
export async function insertIdea(userId, title) {
  const { rows } = await pool.query(
    `INSERT INTO ideas (usuario_id, titulo) VALUES ($1, $2)
     RETURNING id, titulo AS title, estado AS status`,
    [userId, title],
  );
  return rows[0];
}

/**
 * ¿La idea existe y se puede votar? Las que están listas, en revisión o descartadas no.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function isVotable(id) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM ideas WHERE id = $1 AND estado IN ('planeada','en_progreso')",
    [id],
  );
  return rowCount > 0;
}

/**
 * Registra el voto; si ya existía, no hace nada.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function addVote(id, userId) {
  await pool.query('INSERT INTO idea_votos (idea_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    id,
    userId,
  ]);
}

/**
 * Quita el voto; si no existía, no hace nada.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function removeVote(id, userId) {
  await pool.query('DELETE FROM idea_votos WHERE idea_id = $1 AND usuario_id = $2', [id, userId]);
}
