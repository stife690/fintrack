import { Router } from 'express';
import { getAnalytics } from '../controllers/analytics.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de analítica (se montan en `/api/v1/analytics`). Exigen access token.
 * - `GET /` → proyección, gastos hormiga y puntaje del mes actual.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getAnalytics);

export default router;
