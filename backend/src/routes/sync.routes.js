import { Router } from 'express';
import { postSyncBatch } from '../controllers/sync.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de sincronización offline (se montan en `/api/v1/sync`). Exigen access token.
 * - `POST /batch` → aplica un lote de operaciones y devuelve los cambios del servidor.
 */
const router = Router();

router.use(requireAuth);
router.post('/batch', postSyncBatch);

export default router;