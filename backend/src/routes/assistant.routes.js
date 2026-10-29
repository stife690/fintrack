import { Router } from 'express';
import { postChat } from '../controllers/assistant.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createAssistantDailyLimit } from '../middlewares/rate-limit.middleware.js';

/**
 * Rutas del asistente financiero (se montan en `/api/v1/assistant`). Exigen access token.
 * - `POST /chat` → `{ messages }` → `{ reply }`. Límite diario de preguntas por usuario.
 */
const router = Router();

router.use(requireAuth);
// Después de requireAuth: el límite se cuenta por usuario.
router.post('/chat', createAssistantDailyLimit(), postChat);

export default router;
