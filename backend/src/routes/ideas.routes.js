import { Router } from 'express';
import { deleteVote, getIdeas, postIdea, postVote } from '../controllers/ideas.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de Lo que viene (FT-0026), montadas en `/api/v1/ideas`. Exigen access token.
 * - `GET /` · `POST /` → ideas públicas · enviar una idea (queda en revisión).
 * - `POST /:id/vote` · `DELETE /:id/vote` → votar · quitar el voto.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getIdeas);
router.post('/', postIdea);
router.post('/:id/vote', postVote);
router.delete('/:id/vote', deleteVote);

export default router;
