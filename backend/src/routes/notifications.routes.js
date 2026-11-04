import { Router } from 'express';
import { getNotifications, postRead } from '../controllers/notifications.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Centro de notificaciones (se monta en `/api/v1/notifications`, FT-0045). Exigen access token.
 * - `GET /` → avisos recientes y cuántos no ha leído.
 * - `POST /read` → marca todos como leídos.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getNotifications);
router.post('/read', postRead);

export default router;
