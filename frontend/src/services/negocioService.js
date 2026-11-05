/**
 * Capa de Emprendimientos del frontend (FT-0016). Llama a `/api/v1/businesses` con el access
 * token de la sesión.
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {'dueno'|'editor'|'lector'} BusinessRole
 *   `dueno`: administra el negocio y sus socios. `editor`: registra movimientos. `lector`: solo ve.
 */

/**
 * @typedef {object} Partner
 * @property {string} userId
 * @property {string} name Nombre visible.
 * @property {string|null} email Solo lo ven los dueños (y cada quien el suyo).
 * @property {BusinessRole} role
 * @property {number|null} share Participación en %.
 * @property {boolean} isMe
 * @property {string} joinedAt
 */

/**
 * @typedef {object} Business
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} nit
 * @property {string|null} [code] Código de invitación (solo para dueños).
 * @property {BusinessRole} role Rol del usuario actual.
 * @property {number|null} myShare
 * @property {number} membersCount
 * @property {number} [totalShare] Suma de participaciones (solo en el detalle).
 * @property {Partner[]} [partners] Solo en el detalle.
 * @property {Array<{ email: string, role: BusinessRole, sentAt: string }>} [invitations] Solo para dueños.
 * @property {string} updatedAt
 */

/**
 * Negocios del usuario, el de último cambio primero.
 * @returns {Promise<Business[]>}
 */
export function listBusinesses() {
  return apiRequest('/businesses');
}

/**
 * Crea un negocio; quien lo crea queda de dueño.
 * @param {{ name: string, description?: string|null, nit?: string|null }} data
 * @returns {Promise<Business>}
 */
export function createBusiness(data) {
  return apiRequest('/businesses', { method: 'POST', body: data });
}

/**
 * Detalle de un negocio con sus socios.
 * @param {string} id
 * @returns {Promise<Business>}
 */
export function getBusiness(id) {
  return apiRequest(`/businesses/${id}`);
}

/**
 * Cambia nombre, descripción o NIT (dueños).
 * @param {string} id
 * @param {object} changes
 * @returns {Promise<Business>}
 */
export function updateBusiness(id, changes) {
  return apiRequest(`/businesses/${id}`, { method: 'PATCH', body: changes });
}

/**
 * Elimina el negocio para todos (dueños).
 * @param {string} id
 * @returns {Promise<null>}
 */
export function deleteBusiness(id) {
  return apiRequest(`/businesses/${id}`, { method: 'DELETE' });
}

/**
 * Lo que muestra un enlace de invitación antes de unirse.
 * @param {string} code
 * @returns {Promise<{ id: string, name: string, description: string|null, membersCount: number, createdBy: string|null, role: BusinessRole, isMember: boolean }>}
 */
export function previewInvitation(code) {
  return apiRequest(`/businesses/invitations/${encodeURIComponent(code)}`);
}

/**
 * Entra al negocio del código (si ya era socio, solo devuelve el detalle).
 * @param {string} code
 * @returns {Promise<Business>}
 */
export function joinBusiness(code) {
  return apiRequest('/businesses/join', { method: 'POST', body: { code } });
}

/**
 * Código de invitación nuevo: el enlace anterior deja de servir (dueños).
 * @param {string} id
 * @returns {Promise<{ code: string }>}
 */
export function regenerateCode(id) {
  return apiRequest(`/businesses/${id}/code`, { method: 'POST' });
}

/**
 * Invita por correo con un rol (dueños).
 * @param {string} id
 * @param {string} email
 * @param {BusinessRole} role
 * @returns {Promise<{ email: string, role: BusinessRole, sentAt: string, sent: boolean }>}
 */
export function inviteByEmail(id, email, role) {
  return apiRequest(`/businesses/${id}/invitations`, { method: 'POST', body: { email, role } });
}

/**
 * Cancela una invitación por correo (dueños).
 * @param {string} id
 * @param {string} email
 * @returns {Promise<null>}
 */
export function cancelInvitation(id, email) {
  return apiRequest(`/businesses/${id}/invitations?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
}

/**
 * Cambia el rol o la participación de un socio (dueños). `share: null` la quita.
 * @param {string} id
 * @param {string} userId
 * @param {{ role?: BusinessRole, share?: number|null }} changes
 * @returns {Promise<Business>}
 */
export function updatePartner(id, userId, changes) {
  return apiRequest(`/businesses/${id}/partners/${userId}`, { method: 'PATCH', body: changes });
}

/**
 * Saca a un socio (dueños) o deja el negocio (con el id propio).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<null>}
 */
export function removePartner(id, userId) {
  return apiRequest(`/businesses/${id}/partners/${userId}`, { method: 'DELETE' });
}

/* ---------- Movimientos y panel del negocio (FT-0017) ---------- */

/**
 * @typedef {'sale'|'otherIncome'|'cost'|'fixed'|'variable'} MovementKind
 * @typedef {object} BusinessMovement
 * @property {string} id
 * @property {MovementKind} kind
 * @property {string} category
 * @property {number} amount
 * @property {string} description
 * @property {string} date AAAA-MM-DD.
 * @property {{ id: string, name: string|null }|null} registeredBy
 */

/**
 * Movimientos del mes y el panel.
 * @param {string} id
 * @param {string} [month] AAAA-MM; sin él, el mes actual.
 * @returns {Promise<{ month: string, canRecord: boolean, movements: BusinessMovement[], panel: object }>}
 */
export const listMovements = (id, month) =>
  apiRequest(`/businesses/${id}/movements${month ? `?month=${month}` : ''}`);

/**
 * @param {string} id
 * @param {{ kind: MovementKind, amount: number, description: string, category?: string, date?: string, localId?: string }} data
 * @returns {Promise<BusinessMovement>}
 */
export const createMovement = (id, data) =>
  apiRequest(`/businesses/${id}/movements`, { method: 'POST', body: data });

/** @returns {Promise<null>} */
export const deleteMovement = (id, movementId) =>
  apiRequest(`/businesses/${id}/movements/${movementId}`, { method: 'DELETE' });
