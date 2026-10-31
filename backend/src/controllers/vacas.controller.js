import * as vacas from '../services/vacas.service.js';
import {
  parseCode,
  parseContribution,
  parseEmail,
  parseInvitation,
  parseJoin,
  parseMemberChanges,
  parseNewVaca,
  parseVacaChanges,
} from '../validators/vacas.validator.js';

/**
 * `GET /api/v1/vacas`: vacas del usuario con su avance.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getVacas(req, res) {
  res.json(await vacas.list(req.userId));
}

/**
 * `POST /api/v1/vacas`: crea una vaca y responde 201 con su detalle.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postVaca(req, res) {
  res.status(201).json(await vacas.create(req.userId, parseNewVaca(req.body)));
}

/**
 * `GET /api/v1/vacas/:id`: detalle con miembros, cuotas, proyección y aportes.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getVaca(req, res) {
  res.json(await vacas.get(req.userId, req.params.id));
}

/**
 * `PATCH /api/v1/vacas/:id`: cambia nombre, descripción, meta, fecha límite o reparto.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function patchVaca(req, res) {
  res.json(await vacas.update(req.userId, req.params.id, parseVacaChanges(req.body)));
}

/**
 * `DELETE /api/v1/vacas/:id`: elimina la vaca y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteVaca(req, res) {
  await vacas.remove(req.userId, req.params.id);
  res.status(204).end();
}

/**
 * `GET /api/v1/vacas/invitations/:code`: lo que ve quien abre un enlace de invitación.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getInvitationPreview(req, res) {
  res.json(await vacas.preview(req.userId, parseCode(req.params.code)));
}

/**
 * `POST /api/v1/vacas/join`: entra a la vaca del código. 201 si entró ahora, 200 si ya estaba.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postJoin(req, res) {
  const { joined, vaca } = await vacas.join(req.userId, parseJoin(req.body));
  res.status(joined ? 201 : 200).json(vaca);
}

/**
 * `POST /api/v1/vacas/:id/code`: código de invitación nuevo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postCode(req, res) {
  res.json(await vacas.regenerateCode(req.userId, req.params.id));
}

/**
 * `POST /api/v1/vacas/:id/invitations`: invita por correo y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postInvitation(req, res) {
  res.status(201).json(await vacas.invite(req.userId, req.params.id, parseInvitation(req.body)));
}

/**
 * `DELETE /api/v1/vacas/:id/invitations?email=`: cancela una invitación y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteInvitation(req, res) {
  await vacas.cancelInvitation(req.userId, req.params.id, parseEmail(req.query.email));
  res.status(204).end();
}

/**
 * `PATCH /api/v1/vacas/:id/members/:userId`: rol o cuota de un miembro.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function patchMember(req, res) {
  const changes = parseMemberChanges(req.body);
  res.json(await vacas.updateMember(req.userId, req.params.id, req.params.userId, changes));
}

/**
 * `DELETE /api/v1/vacas/:id/members/:userId`: saca a un miembro o deja la vaca (204).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteMember(req, res) {
  await vacas.removeMember(req.userId, req.params.id, req.params.userId);
  res.status(204).end();
}

/**
 * `POST /api/v1/vacas/:id/contributions`: registra un aporte (y su gasto) y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postContribution(req, res) {
  res
    .status(201)
    .json(await vacas.contribute(req.userId, req.params.id, parseContribution(req.body)));
}

/**
 * `DELETE /api/v1/vacas/:id/contributions/:contributionId`: borra un aporte propio.
 * Responde 200 con el id del gasto que también se borró, para quitarlo de la copia local.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteContribution(req, res) {
  res.json(await vacas.removeContribution(req.userId, req.params.id, req.params.contributionId));
}

/**
 * `GET /api/v1/vacas/:id/advice`: consejo para el grupo (IA o reglas).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAdvice(req, res) {
  res.json(await vacas.getAdvice(req.userId, req.params.id));
}

/**
 * `POST /api/v1/vacas/:id/reminders`: push a los miembros atrasados.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postReminders(req, res) {
  res.json(await vacas.remind(req.userId, req.params.id));
}
