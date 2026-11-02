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
 * Todas las ideas, para el panel del equipo.
 * @returns {Promise<{ ideas: Array<{ id: string, title: string, status: string, votes: number, createdAt: string }> }>}
 */
export function getAdminIdeas() {
  return apiRequest('/ideas/admin');
}

/**
 * Agrega una idea del equipo.
 * @param {{ title: string, status: string }} idea
 * @returns {Promise<object>}
 */
export function createAdminIdea(idea) {
  return apiRequest('/ideas/admin', { method: 'POST', body: idea });
}

/**
 * Cambia el título o el estado de una idea.
 * @param {string} id
 * @param {{ title?: string, status?: string }} changes
 * @returns {Promise<object>}
 */
export function updateAdminIdea(id, changes) {
  return apiRequest(`/ideas/admin/${id}`, { method: 'PATCH', body: changes });
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
