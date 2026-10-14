import webpush from 'web-push';
import { env } from '../config/env.js';

/**
 * @typedef {object} SendResult
 * @property {boolean} ok `true` si el servicio push aceptó el mensaje.
 * @property {boolean} gone `true` si la suscripción ya no existe (404/410) y debe borrarse.
 */

/**
 * Crea el emisor de notificaciones Web Push firmadas con las llaves VAPID del servidor.
 * El cliente de `web-push` se inyecta para poder probarlo sin red.
 *
 * @param {object} [options]
 * @param {string} [options.publicKey] Llave pública VAPID.
 * @param {string} [options.privateKey] Llave privada VAPID.
 * @param {string} [options.subject] Contacto del servidor (`mailto:` o URL https).
 * @param {{ sendNotification: (subscription: object, payload: string, options: object) => Promise<unknown> }} [options.client] Cliente de `web-push`.
 * @returns {{ isConfigured: boolean, send: (subscription: object, payload: object) => Promise<SendResult> }}
 */
export function createPushSender({
  publicKey = env.vapidPublicKey,
  privateKey = env.vapidPrivateKey,
  subject = env.vapidSubject,
  client = webpush,
} = {}) {
  const isConfigured = Boolean(publicKey && privateKey);
  const vapidDetails = { subject, publicKey, privateKey };

  return {
    isConfigured,
    /**
     * Envía una notificación a un dispositivo.
     * @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription
     * @param {object} payload Contenido que recibe el service worker (título, texto, url).
     * @returns {Promise<SendResult>}
     */
    async send(subscription, payload) {
      try {
        await client.sendNotification(subscription, JSON.stringify(payload), {
          vapidDetails,
          TTL: 60 * 60,
          timeout: 8000,
        });
        return { ok: true, gone: false };
      } catch (err) {
        // 404/410: el navegador dio de baja la suscripción; no tiene sentido reintentarla.
        if (err?.statusCode === 404 || err?.statusCode === 410) return { ok: false, gone: true };
        console.error(
          `No se pudo enviar la notificación push (${err?.statusCode ?? err?.message})`,
        );
        return { ok: false, gone: false };
      }
    },
  };
}
