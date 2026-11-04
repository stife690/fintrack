import { Router } from 'express';
import {
  deleteCard,
  deletePayment,
  getCard,
  getCards,
  getMovements,
  postCard,
  postPayment,
  postSyncWithBank,
  putCard,
} from '../controllers/cards.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de tarjetas de crédito (se montan en `/api/v1/cards`). Todas exigen access token y solo
 * operan sobre las tarjetas del usuario autenticado (RN-01).
 */
const router = Router();

router.use(requireAuth);
router.get('/', getCards);
router.post('/', postCard);
router.get('/:id', getCard);
router.put('/:id', putCard);
router.delete('/:id', deleteCard);
router.post('/:id/payments', postPayment);
router.delete('/:id/payments/:paymentId', deletePayment);
router.post('/:id/sync-with-bank', postSyncWithBank);
router.get('/:id/movements', getMovements);

export default router;
