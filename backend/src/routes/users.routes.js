import { Router } from 'express';
import { getMe } from '../controllers/users.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de usuario (se montan en `/api/v1/users`). Todas exigen access token.
 * - `GET /me` → perfil del usuario autenticado.
 */
const router = Router();

router.get('/me', requireAuth, getMe);

export default router;
