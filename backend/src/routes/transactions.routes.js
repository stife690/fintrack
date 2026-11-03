import express, { Router } from 'express';
import {
  deleteAttachment,
  getAttachmentFile,
  getAttachments,
  postAttachment,
} from '../controllers/attachments.controller.js';
import {
  deleteTransaction,
  getSummary,
  getTransaction,
  getTransactions,
  postTransaction,
  putTransaction,
} from '../controllers/transactions.controller.js';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { MAX_ATTACHMENT_BYTES } from '../services/attachments.service.js';

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
 * - `GET /:id/attachments` → soportes de pago del movimiento (FT-0044).
 * - `POST /:id/attachments` → adjuntar una foto o PDF (cuerpo binario, nombre en `X-File-Name`).
 * - `GET /:id/attachments/:attachmentId` → ver el archivo.
 * - `DELETE /:id/attachments/:attachmentId` → borrar el soporte.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getTransactions);
router.post('/', postTransaction);
router.get('/summary', getSummary);
router.get('/:id', getTransaction);
router.put('/:id', putTransaction);
router.delete('/:id', deleteTransaction);

// El cuerpo es el archivo crudo, de cualquier tipo: el servicio decide por sus primeros bytes.
// El token ya se revisó arriba: sin sesión no se recibe ni un byte.
const readFile = express.raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES });
/**
 * Lee el archivo y, si pesa de más, responde con el mensaje de los soportes (no el del audio).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function readAttachment(req, res, next) {
  readFile(req, res, (err) => {
    if (err?.type === 'entity.too.large') {
      next(new AppError(413, 'FILE_TOO_LARGE', 'El archivo pesa más de 5 MB'));
    } else {
      next(err);
    }
  });
}
router.get('/:id/attachments', getAttachments);
router.post('/:id/attachments', readAttachment, postAttachment);
router.get('/:id/attachments/:attachmentId', getAttachmentFile);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

export default router;
