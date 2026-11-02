import * as negocios from '../services/negocios.service.js';
import {
  parseBusinessChanges,
  parseCode,
  parseEmail,
  parseInvitation,
  parseJoin,
  parseNewBusiness,
  parsePartnerChanges,
} from '../validators/negocios.validator.js';

/**
 * `GET /api/v1/businesses`: negocios del usuario con su rol.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getBusinesses(req, res) {
  res.json(await negocios.list(req.userId));
}

/**
 * `POST /api/v1/businesses`: crea un negocio y responde 201 con su detalle.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postBusiness(req, res) {
  res.status(201).json(await negocios.create(req.userId, parseNewBusiness(req.body)));
}

/**
 * `GET /api/v1/businesses/:id`: detalle con sus socios.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getBusiness(req, res) {
  res.json(await negocios.get(req.userId, req.params.id));
}

/**
 * `PATCH /api/v1/businesses/:id`: cambia nombre, descripción o NIT.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function patchBusiness(req, res) {
  res.json(await negocios.update(req.userId, req.params.id, parseBusinessChanges(req.body)));
}

/**
 * `DELETE /api/v1/businesses/:id`: elimina el negocio y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteBusiness(req, res) {
  await negocios.remove(req.userId, req.params.id);
  res.status(204).end();
}

/**
 * `GET /api/v1/businesses/invitations/:code`: lo que ve quien abre un enlace de invitación.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getInvitationPreview(req, res) {
  res.json(await negocios.preview(req.userId, parseCode(req.params.code)));
}

/**
 * `POST /api/v1/businesses/join`: entra al negocio del código. 201 si entró ahora, 200 si ya estaba.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postJoin(req, res) {
  const { joined, business } = await negocios.join(req.userId, parseJoin(req.body));
  res.status(joined ? 201 : 200).json(business);
}

/**
 * `POST /api/v1/businesses/:id/code`: código de invitación nuevo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postCode(req, res) {
  res.json(await negocios.regenerateCode(req.userId, req.params.id));
}

/**
 * `POST /api/v1/businesses/:id/invitations`: invita por correo con un rol y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postInvitation(req, res) {
  res.status(201).json(await negocios.invite(req.userId, req.params.id, parseInvitation(req.body)));
}

/**
 * `DELETE /api/v1/businesses/:id/invitations?email=`: cancela una invitación y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteInvitation(req, res) {
  await negocios.cancelInvitation(req.userId, req.params.id, parseEmail(req.query.email));
  res.status(204).end();
}

/**
 * `PATCH /api/v1/businesses/:id/partners/:userId`: rol o participación de un socio.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function patchPartner(req, res) {
  const changes = parsePartnerChanges(req.body);
  res.json(await negocios.updatePartner(req.userId, req.params.id, req.params.userId, changes));
}

/**
 * `DELETE /api/v1/businesses/:id/partners/:userId`: saca a un socio o deja el negocio (204).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deletePartner(req, res) {
  await negocios.removePartner(req.userId, req.params.id, req.params.userId);
  res.status(204).end();
}
