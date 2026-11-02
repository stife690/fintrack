import { Router } from 'express';
import {
  deleteCommitment,
  getProfile,
  postCommitment,
  postWelcome,
  putCommitment,
  putProfile,
} from '../controllers/money-profile.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de Mi plata (se montan en `/api/v1/money-profile`). Todas exigen access token y solo
 * operan sobre los datos del usuario autenticado (RN-01).
 * - `GET /` → perfil y compromisos.
 * - `PUT /` → cómo le entra la plata y cuánta tiene.
 * - `POST /welcome` → guarda la bienvenida o la marca como omitida.
 * - `POST /commitments` → crear un compromiso.
 * - `PUT /commitments/:id` → cambiarlo.
 * - `DELETE /commitments/:id` → eliminarlo.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getProfile);
router.put('/', putProfile);
router.post('/welcome', postWelcome);
router.post('/commitments', postCommitment);
router.put('/commitments/:id', putCommitment);
router.delete('/commitments/:id', deleteCommitment);

export default router;
