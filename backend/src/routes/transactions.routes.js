import { Router } from 'express';
import {
  deleteTransaction,
  getSummary,
  getTransaction,
  getTransactions,
  postTransaction,
  putTransaction,
} from '../controllers/transactions.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de transacciones (se montan en `/api/v1/transactions`). Todas exigen access token
 * y solo operan sobre las transacciones del usuario autenticado (RN-01).
 * - `GET /` → listado paginado con filtros.
 * - `POST /` → registrar (categoría opcional, la IA la sugiere si falta).
 * - `GET /summary` → resumen por categoría y periodo (dashboard). Va antes de `/:id`
 *   porque Express revisa en orden y si no tomaría "summary" como si fuera un id.
 * - `GET /:id` → una transacción puntual.
 * - `PUT /:id` → editar.
 * - `DELETE /:id` → borrado lógico.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getTransactions);
router.post('/', postTransaction);
router.get('/summary', getSummary);
router.get('/:id', getTransaction);
router.put('/:id', putTransaction);
router.delete('/:id', deleteTransaction);

export default router;
