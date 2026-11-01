import { Router } from 'express';
import {
  deleteBusiness,
  deleteInvitation,
  deletePartner,
  getBusiness,
  getBusinesses,
  getInvitationPreview,
  patchBusiness,
  patchPartner,
  postBusiness,
  postCode,
  postInvitation,
  postJoin,
} from '../controllers/negocios.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de Emprendimientos (FT-0016), montadas en `/api/v1/businesses`. Todas exigen access
 * token. Un negocio solo existe para sus socios: a los demás se les responde 404.
 * Roles: `dueno` administra el negocio y sus socios, `editor` registra movimientos, `lector` ve.
 * - `GET /` · `POST /` → mis negocios · crear uno (quien lo crea queda de dueño).
 * - `GET /invitations/:code` · `POST /join` → ver el negocio de un enlace · unirse con el código.
 * - `GET /:id` · `PATCH /:id` · `DELETE /:id` → detalle · editar · eliminar (dueños).
 * - `POST /:id/code` → código de invitación nuevo (dueños).
 * - `POST /:id/invitations` · `DELETE /:id/invitations?email=` → invitar por correo · cancelar (dueños).
 * - `PATCH /:id/partners/:userId` · `DELETE /:id/partners/:userId` → rol o participación · sacar o salirse.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getBusinesses);
router.post('/', postBusiness);
router.get('/invitations/:code', getInvitationPreview);
router.post('/join', postJoin);
router.get('/:id', getBusiness);
router.patch('/:id', patchBusiness);
router.delete('/:id', deleteBusiness);
router.post('/:id/code', postCode);
router.post('/:id/invitations', postInvitation);
router.delete('/:id/invitations', deleteInvitation);
router.patch('/:id/partners/:userId', patchPartner);
router.delete('/:id/partners/:userId', deletePartner);

export default router;
