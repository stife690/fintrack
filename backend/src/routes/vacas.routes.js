import { Router } from 'express';
import {
  deleteContribution,
  deleteInvitation,
  deleteMember,
  deleteVaca,
  getAdvice,
  getInvitationPreview,
  getVaca,
  getVacas,
  patchMember,
  patchVaca,
  postCode,
  postContribution,
  postInvitation,
  postJoin,
  postReminders,
  postVaca,
} from '../controllers/vacas.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de La Vaca Inteligente (FT-0014), montadas en `/api/v1/vacas`. Todas exigen access
 * token. Una vaca solo existe para sus miembros: a los demás se les responde 404 (RN-01).
 * - `GET /` · `POST /` → mis vacas · crear una (quien la crea queda de administrador).
 * - `GET /invitations/:code` · `POST /join` → ver la vaca de un enlace · unirse con el código.
 * - `GET /:id` · `PATCH /:id` · `DELETE /:id` → detalle · editar · eliminar (administradores).
 * - `POST /:id/code` → código de invitación nuevo (administradores).
 * - `POST /:id/invitations` · `DELETE /:id/invitations?email=` → invitar por correo · cancelar.
 * - `PATCH /:id/members/:userId` · `DELETE /:id/members/:userId` → rol o cuota · sacar o salirse.
 * - `POST /:id/contributions` · `DELETE /:id/contributions/:contributionId` → aportar · borrar el propio.
 * - `GET /:id/advice` · `POST /:id/reminders` → consejo para el grupo · push a los atrasados.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getVacas);
router.post('/', postVaca);
router.get('/invitations/:code', getInvitationPreview);
router.post('/join', postJoin);
router.get('/:id', getVaca);
router.patch('/:id', patchVaca);
router.delete('/:id', deleteVaca);
router.post('/:id/code', postCode);
router.post('/:id/invitations', postInvitation);
router.delete('/:id/invitations', deleteInvitation);
router.patch('/:id/members/:userId', patchMember);
router.delete('/:id/members/:userId', deleteMember);
router.post('/:id/contributions', postContribution);
router.delete('/:id/contributions/:contributionId', deleteContribution);
router.get('/:id/advice', getAdvice);
router.post('/:id/reminders', postReminders);

export default router;
