import * as defaultRepo from '../repositories/notifications.repository.js';

/** Cuántos avisos devuelve la lista. */
export const LIST_LIMIT = 30;

/**
 * Solo rutas de la app (`/app/vacas/...`): un aviso nunca lleva a otro sitio.
 * @param {unknown} url
 * @returns {string|null}
 */
export function safeUrl(url) {
  return typeof url === 'string' && /^\/(?!\/)/.test(url) && url.length <= 200 ? url : null;
}

/**
 * Centro de notificaciones (FT-0045): la bandeja donde queda cada aviso que se envía por push.
 * @param {object} [deps]
 * @param {typeof defaultRepo} [deps.repository]
 * @returns {{
 *   record: (userId: string, payload: { title?: string, body?: string, url?: string }) => Promise<void>,
 *   list: (userId: string) => Promise<{ items: object[], unread: number }>,
 *   markAllRead: (userId: string) => Promise<void>,
 * }}
 */
export function createNotificationsService(deps = {}) {
  const repo = deps.repository ?? defaultRepo;

  return {
    /**
     * Guarda un aviso. Los textos se recortan al tamaño de las columnas.
     * @param {string} userId
     * @param {{ title?: string, body?: string, url?: string }} payload El mismo que va por push.
     * @returns {Promise<void>}
     */
    async record(userId, { title, body, url }) {
      await repo.insertNotification({
        userId,
        title: String(title || 'FinTrack').slice(0, 120),
        body: String(body ?? '').slice(0, 300),
        url: safeUrl(url),
      });
    },

    /**
     * Los avisos más recientes y cuántos no ha leído.
     * @param {string} userId
     * @returns {Promise<{ items: object[], unread: number }>}
     */
    async list(userId) {
      return repo.listNotifications(userId, LIST_LIMIT);
    },

    /**
     * Marca todos como leídos (al abrir la bandeja).
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async markAllRead(userId) {
      await repo.markAllRead(userId);
    },
  };
}

export const notifications = createNotificationsService();
