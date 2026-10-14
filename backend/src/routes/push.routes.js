import { Router } from 'express';
import { getVapidPublicKey, subscribe, unsubscribe } from '../controllers/push.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de notificaciones push (se montan en `/api/v1/push`). Todas exigen access token.
 * - `GET /vapid-public-key` → llave pública VAPID.
 * - `POST /subscribe` → registra la suscripción del navegador.
 * - `DELETE /subscribe` → elimina la suscripción.
 */
const router = Router();

router.use(requireAuth);
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', subscribe);
router.delete('/subscribe', unsubscribe);

export default router;
