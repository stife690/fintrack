import { Router } from 'express';
import { getCategories, postSuggestCategory } from '../controllers/categories.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de categorías (se montan en `/api/v1/categories`). Todas exigen access token.
 * - `GET /` → catálogo cerrado de categorías.
 * - `POST /suggest` → categoría sugerida por IA para una descripción.
 */
const router = Router();

router.get('/', requireAuth, getCategories);
router.post('/suggest', requireAuth, postSuggestCategory);

export default router;
