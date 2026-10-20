import { Router } from 'express';
import { getExport } from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de reportes (se montan en `/api/v1/reports`). Exigen access token.
 * - `GET /export` → descarga los movimientos de un periodo en CSV (el PDF llega después).
 */
const router = Router();

router.use(requireAuth);
router.get('/export', getExport);

export default router;
