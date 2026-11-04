import { attachments } from '../services/attachments.service.js';

/**
 * Nombre original del archivo: viene en la cabecera `X-File-Name` codificado con
 * `encodeURIComponent` (las cabeceras no aceptan tildes). Si no se puede leer, el servicio pone uno.
 * @param {import('express').Request} req
 * @returns {string|undefined}
 */
function fileName(req) {
  try {
    return decodeURIComponent(req.get('X-File-Name') ?? '');
  } catch {
    return undefined;
  }
}

/**
 * `GET /api/v1/transactions/:id/attachments`: soportes del movimiento y los límites.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAttachments(req, res) {
  res.json(await attachments.list(req.userId, req.params.id));
}

/**
 * `POST /api/v1/transactions/:id/attachments`: el cuerpo es el archivo crudo (foto o PDF).
 * Responde 201 con el soporte creado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postAttachment(req, res) {
  const created = await attachments.upload(req.userId, req.params.id, {
    data: req.body,
    name: fileName(req),
  });
  res.status(201).json(created);
}

/**
 * `GET /api/v1/transactions/:id/attachments/:attachmentId`: el archivo, para verlo. Nunca se
 * guarda en cachés compartidas: es un documento privado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAttachmentFile(req, res) {
  const file = await attachments.read(req.userId, req.params.id, req.params.attachmentId);
  res.set({
    'Content-Type': file.type,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'Cache-Control': 'private, no-store',
  });
  res.send(file.data);
}

/**
 * `DELETE /api/v1/transactions/:id/attachments/:attachmentId`: borra el soporte. Responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteAttachment(req, res) {
  await attachments.remove(req.userId, req.params.id, req.params.attachmentId);
  res.status(204).end();
}
