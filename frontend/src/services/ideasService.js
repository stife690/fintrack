/**
 * Capa de Lo que viene del frontend, según `docs/api/openapi.yaml` (FT-0026).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} Idea
 * @property {string} id
 * @property {string} title
 * @property {'planeada'|'en_progreso'|'lista'} status
 * @property {number} votes
 * @property {boolean} voted
 */

/** @returns {Promise<{ upcoming: Idea[], done: Idea[] }>} */
export function getIdeas() {
  return apiRequest('/ideas');
}

/**
 * Envía una idea: queda en revisión hasta que el equipo la publique.
 * @param {string} title
 * @returns {Promise<{ id: string, title: string, status: 'revision' }>}
 */
export function sendIdea(title) {
  return apiRequest('/ideas', { method: 'POST', body: { title } });
}

/**
 * Pone o quita el voto.
 * @param {string} id
 * @param {boolean} voted `true` para votar, `false` para quitar el voto.
 * @returns {Promise<void>}
 */
export function setVote(id, voted) {
  return apiRequest(`/ideas/${id}/vote`, { method: voted ? 'POST' : 'DELETE' });
}
