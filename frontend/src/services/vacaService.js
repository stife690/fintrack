/**
 * Capa de La Vaca Inteligente del frontend (FT-0014/FT-0015). Llama a `/api/v1/vacas` con el
 * access token de la sesión.
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {'cumplido'|'al_dia'|'atrasado'|'pendiente'} MemberStatus
 */

/**
 * @typedef {object} VacaProjection
 * @property {number} remaining Lo que falta para la meta.
 * @property {number} averagePerDay Ritmo de aportes por día.
 * @property {string|null} estimatedDate Cuándo se completa a ese ritmo (AAAA-MM-DD).
 * @property {number|null} daysLeft Días para la fecha límite (negativo si ya pasó).
 * @property {number|null} neededPerDay Lo que hay que juntar por día para llegar a tiempo.
 * @property {number|null} neededPerWeek
 * @property {boolean|null} onTrack `null` si no hay fecha límite.
 */

/**
 * @typedef {object} VacaMember
 * @property {string} userId
 * @property {string} name Nombre visible (nunca el correo completo).
 * @property {boolean} isMe
 * @property {'admin'|'miembro'} role
 * @property {number} quota Lo que le toca.
 * @property {number|null} customQuota Cuota puesta por un administrador (reparto personalizado).
 * @property {number} contributed
 * @property {number} remaining
 * @property {number} percentage
 * @property {MemberStatus} status
 */

/**
 * @typedef {object} VacaContribution
 * @property {string} id
 * @property {string|null} userId
 * @property {string} name
 * @property {boolean} isMe
 * @property {number} amount
 * @property {string|null} note
 * @property {string} date AAAA-MM-DD
 * @property {string} createdAt
 */

/**
 * @typedef {object} Vaca
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {number} goal
 * @property {string|null} deadline
 * @property {'igual'|'personalizado'} split
 * @property {string} code Código de invitación.
 * @property {'admin'|'miembro'} role Rol del usuario actual.
 * @property {number} total
 * @property {number} percentage
 * @property {'activa'|'completada'|'vencida'} status
 * @property {number} membersCount
 * @property {number} myQuota
 * @property {number} myContributed
 * @property {number} myRemaining
 * @property {MemberStatus} myStatus
 * @property {VacaProjection} projection
 * @property {VacaMember[]} [members] Solo en el detalle.
 * @property {VacaContribution[]} [contributions] Solo en el detalle (los últimos 50).
 * @property {Array<{ email: string, sentAt: string }>} [invitations] Solo para administradores.
 * @property {string} updatedAt
 */

/**
 * Vacas del usuario, la de último cambio primero.
 * @returns {Promise<Vaca[]>}
 */
export function listVacas() {
  return apiRequest('/vacas');
}

/**
 * Crea una vaca; quien la crea queda de administrador.
 * @param {{ name: string, goal: number, description?: string|null, deadline?: string|null, split?: 'igual'|'personalizado' }} data
 * @returns {Promise<Vaca>}
 */
export function createVaca(data) {
  return apiRequest('/vacas', { method: 'POST', body: data });
}

/**
 * Detalle de una vaca con miembros, cuotas, proyección y aportes.
 * @param {string} id
 * @returns {Promise<Vaca>}
 */
export function getVaca(id) {
  return apiRequest(`/vacas/${id}`);
}

/**
 * Cambia los datos de una vaca (administradores).
 * @param {string} id
 * @param {object} changes
 * @returns {Promise<Vaca>}
 */
export function updateVaca(id, changes) {
  return apiRequest(`/vacas/${id}`, { method: 'PATCH', body: changes });
}

/**
 * Elimina una vaca (administradores).
 * @param {string} id
 * @returns {Promise<null>}
 */
export function deleteVaca(id) {
  return apiRequest(`/vacas/${id}`, { method: 'DELETE' });
}

/**
 * Lo que muestra un enlace de invitación antes de unirse.
 * @param {string} code
 * @returns {Promise<{ id: string, name: string, description: string|null, goal: number, total: number, deadline: string|null, membersCount: number, createdBy: string|null, isMember: boolean }>}
 */
export function previewInvitation(code) {
  return apiRequest(`/vacas/invitations/${encodeURIComponent(code)}`);
}

/**
 * Entra a la vaca del código (si ya era miembro, solo devuelve el detalle).
 * @param {string} code
 * @returns {Promise<Vaca>}
 */
export function joinVaca(code) {
  return apiRequest('/vacas/join', { method: 'POST', body: { code } });
}

/**
 * Código de invitación nuevo: el enlace anterior deja de servir (administradores).
 * @param {string} id
 * @returns {Promise<{ code: string }>}
 */
export function regenerateCode(id) {
  return apiRequest(`/vacas/${id}/code`, { method: 'POST' });
}

/**
 * Invita por correo; le llega el enlace para unirse.
 * @param {string} id
 * @param {string} email
 * @returns {Promise<{ email: string, sentAt: string, sent: boolean }>}
 */
export function inviteByEmail(id, email) {
  return apiRequest(`/vacas/${id}/invitations`, { method: 'POST', body: { email } });
}

/**
 * Cancela una invitación por correo (administradores).
 * @param {string} id
 * @param {string} email
 * @returns {Promise<null>}
 */
export function cancelInvitation(id, email) {
  return apiRequest(`/vacas/${id}/invitations?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
}

/**
 * Cambia el rol o la cuota de un miembro (administradores). `quota: null` vuelve a la calculada.
 * @param {string} id
 * @param {string} userId
 * @param {{ role?: 'admin'|'miembro', quota?: number|null }} changes
 * @returns {Promise<Vaca>}
 */
export function updateMember(id, userId, changes) {
  return apiRequest(`/vacas/${id}/members/${userId}`, { method: 'PATCH', body: changes });
}

/**
 * Saca a un miembro (administradores) o deja la vaca (con el id propio).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<null>}
 */
export function removeMember(id, userId) {
  return apiRequest(`/vacas/${id}/members/${userId}`, { method: 'DELETE' });
}

/**
 * Registra un aporte; también queda como gasto en los movimientos. Con el mismo `localId` no
 * se duplica.
 * @param {string} id
 * @param {{ amount: number, date: string, note?: string|null, category?: string|null, localId: string }} data
 * @returns {Promise<{ contribution: VacaContribution, transaction: import('./transactionService').Transaction, vaca: Vaca }>}
 */
export function contribute(id, data) {
  return apiRequest(`/vacas/${id}/contributions`, { method: 'POST', body: data });
}

/**
 * Borra un aporte propio y el gasto que dejó.
 * @param {string} id
 * @param {string} contributionId
 * @returns {Promise<{ transactionId: string|null }>}
 */
export function deleteContribution(id, contributionId) {
  return apiRequest(`/vacas/${id}/contributions/${contributionId}`, { method: 'DELETE' });
}

/**
 * Consejo para el grupo (IA con datos agregados, o reglas si la IA no responde).
 * @param {string} id
 * @returns {Promise<{ advice: string, source: 'ia'|'reglas', generatedAt: string }>}
 */
export function getAdvice(id) {
  return apiRequest(`/vacas/${id}/advice`);
}

/**
 * Envía un recordatorio push a los miembros atrasados (administradores, uno cada 12 horas).
 * @param {string} id
 * @returns {Promise<{ reminded: number, delivered: number }>}
 */
export function sendReminders(id) {
  return apiRequest(`/vacas/${id}/reminders`, { method: 'POST' });
}
