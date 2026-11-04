/**
 * Pagos con Apple Pay que llegan desde Atajos del iPhone (FT-0047), según `docs/api/openapi.yaml`
 * (`/pending-payments` y `/shortcuts/payments`).
 */
import { apiRequest } from '@/lib/apiRequest';
import { API_V1 } from '@/lib/api';

/**
 * @typedef {object} PendingPayment
 * @property {string} id
 * @property {string} merchant Comercio.
 * @property {number} amount
 * @property {string} date AAAA-MM-DD.
 * @property {string|null} card Nombre de la tarjeta en Wallet.
 * @property {'pending'|'confirmed'|'discarded'} status
 * @property {boolean} possibleDuplicate Ya hay un gasto igual entre un día antes y uno después.
 */

/** Dirección a la que el Atajo manda cada pago. */
export const SHORTCUT_URL = `${API_V1}/shortcuts/payments`;

/** @returns {Promise<{ enabled: boolean, token: { createdAt: string, lastUsedAt: string|null }|null }>} */
export const getShortcutToken = () => apiRequest('/pending-payments/token');

/** @returns {Promise<{ token: string, createdAt: string, lastUsedAt: null }>} Única vez que se ve el token. */
export const createShortcutToken = () => apiRequest('/pending-payments/token', { method: 'POST' });

/** @returns {Promise<null>} */
export const revokeShortcutToken = () => apiRequest('/pending-payments/token', { method: 'DELETE' });

/** @returns {Promise<{ items: PendingPayment[] }>} */
export const listPendingPayments = () => apiRequest('/pending-payments');

/**
 * Crea el gasto. Sin `category` la elige la IA; sin `description` se usa el comercio.
 * @param {string} id
 * @param {{ category?: string, description?: string }} data
 * @returns {Promise<{ payment: PendingPayment, transaction: object }>}
 */
export const confirmPendingPayment = (id, data) => apiRequest(`/pending-payments/${id}/confirm`, { method: 'POST', body: data });

/** @returns {Promise<PendingPayment>} */
export const discardPendingPayment = (id) => apiRequest(`/pending-payments/${id}/discard`, { method: 'POST' });
