import { Router } from 'express';
import {
  deleteDebt,
  getDebts,
  postDebt,
  postSettle,
  putDebt,
} from '../controllers/debts.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de cuentas personales por cobrar y por pagar (FT-0046), montadas en `/api/v1/debts`.
 * Todas exigen access token y solo operan sobre las cuentas del usuario (RN-01).
 */
const router = Router();

router.use(requireAuth);
router.get('/', getDebts);
router.post('/', postDebt);
router.put('/:id', putDebt);
router.delete('/:id', deleteDebt);
router.post('/:id/settle', postSettle);

export default router;
