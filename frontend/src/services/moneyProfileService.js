/**
 * Capa de Mi plata del frontend, según `docs/api/openapi.yaml` (FT-0036).
 * Llama a `/api/v1/money-profile` con el access token de la sesión.
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} Commitment
 * @property {string} id
 * @property {string} name
 * @property {number} amount Monto mensual.
 * @property {number} dayOfMonth Día del mes en que se paga.
 */

/**
 * @typedef {object} MoneyProfile
 * @property {'fecha_fija'|'sin_fecha'|null} incomeType
 * @property {number[]} payDays
 * @property {number|null} balance Plata que el usuario dijo tener.
 * @property {string|null} balanceAt Cuándo lo dijo.
 * @property {number|null} money Plata actual: `balance` más lo registrado después.
 * @property {{ income: number, expense: number }} totals Todo lo registrado.
 * @property {boolean} welcomeDone `true` si ya respondió u omitió la bienvenida.
 * @property {Commitment[]} commitments
 */

/** @returns {Promise<MoneyProfile>} */
export function getMoneyProfile() {
  return apiRequest('/money-profile');
}

/**
 * Cuánto puede gastar o necesita ganar el usuario hoy (FT-0037).
 * @returns {Promise<{ ready: boolean } & Record<string, any>>} Ver `GET /money-profile/plan` en la API.
 */
export function getMoneyPlan() {
  return apiRequest('/money-profile/plan');
}

/**
 * Cambia cómo le entra la plata al usuario y cuánta tiene.
 * @param {{ incomeType: string|null, payDays: number[], balance: number|null, resetBalance?: boolean }} data
 * @returns {Promise<MoneyProfile>}
 */
export function updateMoneyProfile(data) {
  return apiRequest('/money-profile', { method: 'PUT', body: data });
}

/**
 * Guarda la bienvenida. Sin datos, la marca como omitida.
 * @param {{ incomeType?: string|null, payDays?: number[], balance?: number|null, commitments?: Omit<Commitment, 'id'>[] }} [answers]
 * @returns {Promise<MoneyProfile>}
 */
export function finishWelcome(answers = {}) {
  return apiRequest('/money-profile/welcome', { method: 'POST', body: answers });
}

/**
 * @param {Omit<Commitment, 'id'>} data
 * @returns {Promise<Commitment>}
 */
export function createCommitment(data) {
  return apiRequest('/money-profile/commitments', { method: 'POST', body: data });
}

/**
 * @param {string} id
 * @param {Omit<Commitment, 'id'>} data
 * @returns {Promise<Commitment>}
 */
export function updateCommitment(id, data) {
  return apiRequest(`/money-profile/commitments/${id}`, { method: 'PUT', body: data });
}

/**
 * @param {string} id
 * @returns {Promise<null>}
 */
export function deleteCommitment(id) {
  return apiRequest(`/money-profile/commitments/${id}`, { method: 'DELETE' });
}
