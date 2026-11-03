/**
 * Soportes de pago de un movimiento (FT-0044), según `docs/api/openapi.yaml`.
 * Los archivos van y vienen como binarios por la API con la sesión: nunca hay enlaces públicos.
 */
import { authFetch } from '@/lib/authFetch';
import { apiRequest, toApiError } from '@/lib/apiRequest';

const CONNECTION_ERROR = 'No pudimos conectar con el servidor. Revisa tu conexión.';

/**
 * @typedef {object} Attachment
 * @property {string} id
 * @property {string} name Nombre original del archivo.
 * @property {'image/jpeg'|'image/png'|'image/webp'|'application/pdf'} type
 * @property {number} size Bytes.
 * @property {string} createdAt
 */

/**
 * Soportes del movimiento. Si el usuario no los tiene activos, falla con `code` `FEATURE_DISABLED`.
 * @param {string} transactionId
 * @returns {Promise<{ items: Attachment[], max: number, maxBytes: number }>}
 */
export function listAttachments(transactionId) {
  return apiRequest(`/transactions/${transactionId}/attachments`);
}

/**
 * Adjunta un archivo (ya comprimido si es foto).
 * @param {string} transactionId
 * @param {Blob} file
 * @param {string} name Nombre para mostrar.
 * @returns {Promise<Attachment>}
 */
export async function uploadAttachment(transactionId, file, name) {
  let res;
  try {
    res = await authFetch(`/transactions/${transactionId}/attachments`, {
      method: 'POST',
      body: file,
      // Las cabeceras no aceptan tildes: el backend lo decodifica.
      headers: { 'X-File-Name': encodeURIComponent(name) },
    });
  } catch {
    throw new Error(CONNECTION_ERROR);
  }
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/**
 * Descarga el archivo de un soporte para verlo.
 * @param {string} transactionId
 * @param {string} id
 * @returns {Promise<Blob>}
 */
export async function fetchAttachment(transactionId, id) {
  let res;
  try {
    res = await authFetch(`/transactions/${transactionId}/attachments/${id}`);
  } catch {
    throw new Error(CONNECTION_ERROR);
  }
  if (!res.ok) throw await toApiError(res);
  return res.blob();
}

/**
 * @param {string} transactionId
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteAttachment(transactionId, id) {
  await apiRequest(`/transactions/${transactionId}/attachments/${id}`, { method: 'DELETE' });
}
