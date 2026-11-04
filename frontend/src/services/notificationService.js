/**
 * Centro de notificaciones (FT-0045), según `docs/api/openapi.yaml` (`/notifications`).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} AppNotification
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {string|null} url Ruta de la app a la que lleva.
 * @property {boolean} read
 * @property {string} createdAt Fecha ISO.
 */

/** @returns {Promise<{ items: AppNotification[], unread: number }>} */
export function getNotifications() {
  return apiRequest('/notifications');
}

/** Marca todos los avisos como leídos. @returns {Promise<null>} */
export function markNotificationsRead() {
  return apiRequest('/notifications/read', { method: 'POST' });
}
