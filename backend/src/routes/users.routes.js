import { Router } from 'express';
import {
  getMe,
  getReminderSettings,
  putReminderSettings,
} from '../controllers/users.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de usuario (se montan en `/api/v1/users`). Todas exigen access token.
 * - `GET /me` → perfil del usuario autenticado.
 * - `GET /me/reminder-settings` → hora y zona horaria del recordatorio diario.
 * - `PUT /me/reminder-settings` → actualiza el recordatorio diario (`time: null` lo desactiva).
 */
const router = Router();

router.get('/me', requireAuth, getMe);
router.get('/me/reminder-settings', requireAuth, getReminderSettings);
router.put('/me/reminder-settings', requireAuth, putReminderSettings);

export default router;
