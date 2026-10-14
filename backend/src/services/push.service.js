import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';
import {
  deleteSubscription,
  deleteSubscriptionByEndpoint,
  listSubscriptionsByUser,
  upsertSubscription,
} from '../repositories/push.repository.js';
import {
  findReminderSettings,
  saveReminderSettings,
} from '../repositories/reminders.repository.js';
import { createPushSender } from './push-sender.service.js';

/**
 * Crea el servicio de notificaciones push. Las dependencias se inyectan para probarlo sin BD ni red.
 *
 * @param {object} [deps]
 * @param {string} [deps.vapidPublicKey] Llave pública VAPID que se entrega al navegador.
 * @param {ReturnType<typeof createPushSender>} [deps.sender]
 * @param {{ upsertSubscription: typeof upsertSubscription, deleteSubscription: typeof deleteSubscription, deleteSubscriptionByEndpoint: typeof deleteSubscriptionByEndpoint, listSubscriptionsByUser: typeof listSubscriptionsByUser }} [deps.subscriptions]
 * @param {{ findReminderSettings: typeof findReminderSettings, saveReminderSettings: typeof saveReminderSettings }} [deps.reminders]
 * @returns {{
 *   getVapidPublicKey: () => { key: string },
 *   subscribe: (userId: string, subscription: { endpoint: string, keys: object }) => Promise<void>,
 *   unsubscribe: (userId: string, endpoint: string) => Promise<void>,
 *   sendToUser: (userId: string, payload: object) => Promise<{ sent: number, removed: number }>,
 *   getReminderSettings: (userId: string) => Promise<{ time: string|null, timezone: string }>,
 *   updateReminderSettings: (userId: string, settings: { time: string|null, timezone: string }) => Promise<{ time: string|null, timezone: string }>
 * }}
 */
export function createPushService(deps = {}) {
  const vapidPublicKey = deps.vapidPublicKey ?? env.vapidPublicKey;
  const sender = deps.sender ?? createPushSender();
  const subscriptions = deps.subscriptions ?? {
    upsertSubscription,
    deleteSubscription,
    deleteSubscriptionByEndpoint,
    listSubscriptionsByUser,
  };
  const reminders = deps.reminders ?? { findReminderSettings, saveReminderSettings };

  /**
   * @param {{ time: string|null, timezone: string }|null} settings
   * @returns {{ time: string|null, timezone: string }}
   */
  function requireSettings(settings) {
    if (!settings) {
      // El token es válido pero la cuenta ya no existe.
      throw new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    }
    return { time: settings.time, timezone: settings.timezone };
  }

  return {
    getVapidPublicKey() {
      if (!vapidPublicKey) {
        throw new AppError(500, 'INTERNAL_ERROR', 'Las notificaciones push no están configuradas');
      }
      return { key: vapidPublicKey };
    },

    async subscribe(userId, subscription) {
      await subscriptions.upsertSubscription({ userId, ...subscription });
    },

    async unsubscribe(userId, endpoint) {
      const removed = await subscriptions.deleteSubscription({ userId, endpoint });
      if (!removed) throw new AppError(404, 'NOT_FOUND', 'Suscripción no encontrada');
    },

    /**
     * Envía una notificación a todos los dispositivos del usuario y borra los que ya no existen.
     * Sin suscripciones (o sin llaves VAPID) no envía nada.
     * @param {string} userId
     * @param {object} payload
     * @returns {Promise<{ sent: number, removed: number }>}
     */
    async sendToUser(userId, payload) {
      if (!sender.isConfigured) return { sent: 0, removed: 0 };
      const devices = await subscriptions.listSubscriptionsByUser(userId);
      let sent = 0;
      let removed = 0;
      for (const device of devices) {
        const result = await sender.send(device, payload);
        if (result.ok) sent += 1;
        if (result.gone) {
          await subscriptions.deleteSubscriptionByEndpoint(device.endpoint);
          removed += 1;
        }
      }
      return { sent, removed };
    },

    async getReminderSettings(userId) {
      return requireSettings(await reminders.findReminderSettings(userId));
    },

    async updateReminderSettings(userId, settings) {
      return requireSettings(await reminders.saveReminderSettings(userId, settings));
    },
  };
}

/** Servicio de push con las dependencias reales (BD y `web-push`). */
export const pushService = createPushService();
