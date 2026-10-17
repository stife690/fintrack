import { Router } from 'express';
import {
  deleteBudget,
  getBudgets,
  postBudget,
  putBudget,
} from '../controllers/budgets.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de presupuestos (se montan en `/api/v1/budgets`). Todas exigen access token
 * y solo operan sobre los presupuestos del usuario autenticado (RN-01).
 * - `GET /` → presupuestos del mes (`?month=AAAA-MM`, por defecto el actual).
 * - `POST /` → crear (solo categorías de gasto; uno por categoría y mes).
 * - `PUT /:id` → cambiar el monto.
 * - `DELETE /:id` → eliminar.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getBudgets);
router.post('/', postBudget);
router.put('/:id', putBudget);
router.delete('/:id', deleteBudget);

export default router;