import { Router } from 'express';
import { getInsights } from '../controllers/insights.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de insights (se montan en `/api/v1/insights`). Exigen access token.
 * - `GET /` → insights del mes actual (se generan y cachean si no existen).
 */
const router = Router();

router.use(requireAuth);
router.get('/', getInsights);

export default router;
