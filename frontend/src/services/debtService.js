/**
 * Cuentas por cobrar y por pagar (FT-0046), según `docs/api/openapi.yaml` (`/debts`).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} Debt
 * @property {string} id
 * @property {'receivable'|'payable'} kind `receivable`: me deben; `payable`: debo.
 * @property {string} person
 * @property {number} amount
 * @property {string|null} dueDate AAAA-MM-DD.
 * @property {string|null} note
 * @property {string|null} settledAt Fecha ISO en que se saldó.
 * @property {string|null} transactionId Movimiento creado al saldarla.
 */

/** @returns {Promise<{ items: Debt[], totals: { receivable: number, payable: number } }>} */
export const listDebts = () => apiRequest('/debts');

/** @returns {Promise<Debt>} */
export const createDebt = (data) => apiRequest('/debts', { method: 'POST', body: data });

/** @returns {Promise<Debt>} */
export const updateDebt = (id, data) => apiRequest(`/debts/${id}`, { method: 'PUT', body: data });

/** @returns {Promise<null>} */
export const deleteDebt = (id) => apiRequest(`/debts/${id}`, { method: 'DELETE' });

/**
 * Salda la cuenta; con `createTransaction` también registra el ingreso o el gasto.
 * @param {string} id
 * @param {{ createTransaction: boolean }} options
 * @returns {Promise<{ debt: Debt, transaction: object|null }>}
 */
export const settleDebt = (id, { createTransaction }) =>
  apiRequest(`/debts/${id}/settle`, {
    method: 'POST',
    body: { createTransaction },
  });
