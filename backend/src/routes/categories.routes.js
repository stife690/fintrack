import { Router } from 'express';
import {
  deleteCategory,
  getCategories,
  patchCategory,
  postCategory,
} from '../controllers/categories.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de categorías (se montan en `/api/v1/categories`). Todas exigen access token.
 * - `GET /` → las 15 de todos y las propias del usuario.
 * - `POST /` → crea una propia (máximo 20).
 * - `PATCH /:key` → renombra o cambia ícono y color de una propia.
 * - `DELETE /:key` → elimina una propia; sus movimientos pasan a "Otros".
 */
const router = Router();

router.use(requireAuth);
router.get('/', getCategories);
router.post('/', postCategory);
router.patch('/:key', patchCategory);
router.delete('/:key', deleteCategory);

export default router;
