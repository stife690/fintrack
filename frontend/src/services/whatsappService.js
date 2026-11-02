/**
 * Conexión del número con el bot de WhatsApp, según `docs/api/openapi.yaml` (`/whatsapp/link`).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} WhatsappLink
 * @property {boolean} available Si el bot está configurado.
 * @property {boolean} linked
 * @property {string|null} phone Solo los últimos cuatro dígitos.
 * @property {string|null} botNumber
 */

/** @returns {Promise<WhatsappLink>} */
export function getWhatsappLink() {
  return apiRequest('/whatsapp/link');
}

/** @returns {Promise<{ code: string, expiresAt: string, botNumber: string|null }>} */
export function createWhatsappCode() {
  return apiRequest('/whatsapp/link', { method: 'POST' });
}

/** @returns {Promise<null>} */
export function deleteWhatsappLink() {
  return apiRequest('/whatsapp/link', { method: 'DELETE' });
}
