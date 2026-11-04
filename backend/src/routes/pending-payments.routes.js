import { Router } from 'express';
import {
  deleteToken,
  getPending,
  getToken,
  postConfirm,
  postDiscard,
  postShortcutPayment,
  postToken,
} from '../controllers/pending-payments.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Pagos por confirmar (FT-0047), montadas en `/api/v1/pending-payments`. Exigen la sesión normal
 * y solo operan sobre los pagos del usuario (RN-01).
 */
const router = Router();

router.use(requireAuth);
router.get('/token', getToken);
router.post('/token', postToken);
router.delete('/token', deleteToken);
router.get('/', getPending);
router.post('/:id/confirm', postConfirm);
router.post('/:id/discard', postDiscard);

export default router;

/**
 * Entrada del Atajo del iPhone, montada en `/api/v1/shortcuts`. No usa la sesión de la app sino
 * el token personal del Atajo, que solo sirve para mandar pagos a "Por confirmar".
 */
export const shortcutsRouter = Router();
shortcutsRouter.post('/payments', postShortcutPayment);
