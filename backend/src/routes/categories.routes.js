import { Router } from 'express';
import { getCategories } from '../controllers/categories.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de categorías (se montan en `/api/v1/categories`). Todas exigen access token.
 * - `GET /` → catálogo cerrado de categorías.
 */
const router = Router();

router.get('/', requireAuth, getCategories);

export default router;
