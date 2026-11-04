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
import { notifications } from './notifications.service.js';
import { createPushSender } from './push-sender.service.js';

/**
 * @typedef {object} ReminderSettingsResponse
 * @property {string[]} times Horas locales del recordatorio (HH:mm), ordenadas; vacío si está desactivado.
 * @property {string|null} time Primera hora de `times` (o `null`). Compatibilidad con clientes anteriores.
 * @property {string} timezone Zona horaria IANA.
 * @property {boolean} cardReminders Si recibe el aviso de pago de tarjetas.
 */

/**
 * Crea el servicio de notificaciones push. Las dependencias se inyectan para probarlo sin BD ni red.
 *
 * @param {object} [deps]
 * @param {string} [deps.vapidPublicKey] Llave pública VAPID que se entrega al navegador.
 * @param {ReturnType<typeof createPushSender>} [deps.sender]
 * @param {{ upsertSubscription: typeof upsertSubscription, deleteSubscription: typeof deleteSubscription, deleteSubscriptionByEndpoint: typeof deleteSubscriptionByEndpoint, listSubscriptionsByUser: typeof listSubscriptionsByUser }} [deps.subscriptions]
 * @param {{ findReminderSettings: typeof findReminderSettings, saveReminderSettings: typeof saveReminderSettings }} [deps.reminders]
 * @param {{ record: (userId: string, payload: object) => Promise<void> }} [deps.inbox] Bandeja de avisos (FT-0045).
 * @returns {{
 *   getVapidPublicKey: () => { key: string },
 *   subscribe: (userId: string, subscription: { endpoint: string, keys: object }) => Promise<void>,
 *   unsubscribe: (userId: string, endpoint: string) => Promise<void>,
 *   sendToUser: (userId: string, payload: object, options?: { inbox?: boolean }) => Promise<{ sent: number, removed: number }>,
 *   getReminderSettings: (userId: string) => Promise<ReminderSettingsResponse>,
 *   updateReminderSettings: (userId: string, settings: { times: string[], timezone: string, cardReminders?: boolean }) => Promise<ReminderSettingsResponse>
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
  const inbox = deps.inbox ?? notifications;

  /**
   * @param {{ times: string[], timezone: string, cardReminders: boolean }|null} settings
   * @returns {ReminderSettingsResponse}
   */
  function requireSettings(settings) {
    if (!settings) {
      // El token es válido pero la cuenta ya no existe.
      throw new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    }
    return {
      times: settings.times,
      time: settings.times[0] ?? null,
      timezone: settings.timezone,
      cardReminders: settings.cardReminders,
    };
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
     * Guarda el aviso en la bandeja de la app (FT-0045) y lo envía a todos los dispositivos del
     * usuario, borrando los que ya no existen. Sin suscripciones (o sin llaves VAPID) solo queda en
     * la bandeja. Si la bandeja falla, el push igual sale.
     * @param {string} userId
     * @param {object} payload `{ title, body, url }`.
     * @param {{ inbox?: boolean }} [options] `inbox: false` para avisos que no vale la pena guardar
     *   (el recordatorio diario de registrar gastos).
     * @returns {Promise<{ sent: number, removed: number }>}
     */
    async sendToUser(userId, payload, { inbox: keep = true } = {}) {
      if (keep) {
        await inbox.record(userId, payload).catch((err) => {
          console.error(`No se guardó el aviso en la bandeja (${err.message})`);
        });
      }
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
