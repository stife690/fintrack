import { Router } from 'express';
import {
  deleteVote,
  getAdminIdeas,
  getIdeas,
  patchAdminIdea,
  postAdminIdea,
  postIdea,
  postVote,
} from '../controllers/ideas.controller.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de Lo que viene (FT-0026), montadas en `/api/v1/ideas`. Exigen access token.
 * - `GET /` · `POST /` → ideas públicas · enviar una idea (queda en revisión).
 * - `POST /:id/vote` · `DELETE /:id/vote` → votar · quitar el voto.
 * - `GET /admin` · `POST /admin` · `PATCH /admin/:id` → panel del equipo (solo `ADMIN_EMAILS`).
 */
const router = Router();

router.use(requireAuth);
router.get('/', getIdeas);
router.post('/', postIdea);
router.get('/admin', requireAdmin, getAdminIdeas);
router.post('/admin', requireAdmin, postAdminIdea);
router.patch('/admin/:id', requireAdmin, patchAdminIdea);
router.post('/:id/vote', postVote);
router.delete('/:id/vote', deleteVote);

export default router;
