import * as ideas from '../services/ideas.service.js';
import { parseAdminIdea, parseIdeaChanges, parseNewIdea } from '../validators/ideas.validator.js';

/**
 * `GET /api/v1/ideas`: ideas públicas, con los votos y si el usuario ya votó.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getIdeas(req, res) {
  res.json(await ideas.list(req.userId));
}

/**
 * `POST /api/v1/ideas`: recibe una idea y responde 201. Queda en revisión.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postIdea(req, res) {
  const { title } = parseNewIdea(req.body);
  res.status(201).json(await ideas.create(req.userId, title));
}

/**
 * `GET /api/v1/ideas/admin`: todas las ideas, para el equipo.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAdminIdeas(_req, res) {
  res.json(await ideas.listAll());
}

/**
 * `POST /api/v1/ideas/admin`: el equipo agrega una idea y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postAdminIdea(req, res) {
  res.status(201).json(await ideas.createFromTeam(parseAdminIdea(req.body)));
}

/**
 * `PATCH /api/v1/ideas/admin/:id`: el equipo cambia el título o el estado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function patchAdminIdea(req, res) {
  res.json(await ideas.update(req.params.id, parseIdeaChanges(req.body)));
}

/**
 * `POST /api/v1/ideas/:id/vote`: vota por una idea y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postVote(req, res) {
  await ideas.vote(req.userId, req.params.id);
  res.status(204).end();
}

/**
 * `DELETE /api/v1/ideas/:id/vote`: quita el voto y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteVote(req, res) {
  await ideas.unvote(req.userId, req.params.id);
  res.status(204).end();
}
