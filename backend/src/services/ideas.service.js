import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/ideas.repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ideas que puede enviar una persona en 24 horas: frena el spam sin molestar a nadie. */
export const MAX_IDEAS_PER_DAY = 5;

/**
 * Separa las ideas públicas en lo que viene y lo que ya está disponible, conservando el orden.
 * @param {import('../repositories/ideas.repository.js').PublishedIdea[]} ideas
 * @returns {{ upcoming: object[], done: object[] }}
 */
export function groupIdeas(ideas) {
  return {
    upcoming: ideas.filter(({ status }) => status !== 'lista'),
    done: ideas.filter(({ status }) => status === 'lista'),
  };
}

/** @returns {AppError} 404: la idea no existe o no se puede votar. */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Idea no encontrada');
}

/**
 * Lista las ideas públicas para un usuario.
 * @param {string} userId
 * @returns {Promise<{ upcoming: object[], done: object[] }>}
 */
export async function list(userId) {
  return groupIdeas(await repo.listPublished(userId));
}

/**
 * Recibe una idea: queda en revisión hasta que el equipo la publique.
 * @param {string} userId
 * @param {string} title
 * @returns {Promise<{ id: string, title: string, status: 'revision' }>}
 * @throws {AppError} 429 si ya envió el máximo del día.
 */
export async function create(userId, title) {
  if ((await repo.countRecent(userId)) >= MAX_IDEAS_PER_DAY) {
    throw new AppError(429, 'RATE_LIMITED', 'Ya enviaste varias ideas hoy. Gracias: vuelve mañana.');
  }
  return repo.insertIdea(userId, title);
}

/**
 * Vota por una idea. Votar dos veces deja un solo voto.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 * @throws {AppError} 404 si la idea no existe o ya no se puede votar.
 */
export async function vote(userId, id) {
  if (!UUID_RE.test(id) || !(await repo.isVotable(id))) throw notFound();
  await repo.addVote(id, userId);
}

/**
 * Quita el voto del usuario. No falla si no había votado.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 * @throws {AppError} 404 si el id no es válido.
 */
export async function unvote(userId, id) {
  if (!UUID_RE.test(id)) throw notFound();
  await repo.removeVote(id, userId);
}
