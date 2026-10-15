/**
 * Capa de notificaciones push del frontend, según `docs/api/openapi.yaml`.
 *
 * Llama a `/api/v1/push/*` y `/api/v1/users/me/reminder-settings` con el access token de la
 * sesión. Los errores de la API (`{ error: { code, message, details? } }`) se convierten en
 * un `Error` con mensaje para el usuario; el `code` de la API queda en `err.code`.
 */
import { authFetch } from '@/lib/authFetch';
import { getCurrentSubscription, isPushSupported } from '@/lib/push';

/**
 * @typedef {object} ReminderSettings
 * @property {string|null} time Hora local del recordatorio en formato HH:mm; `null` si está desactivado.
 * @property {string} timezone Zona horaria IANA.
 */

/**
 * Hace una petición autenticada y devuelve el JSON (o `null` si no hay cuerpo).
 * @param {string} path Ruta bajo `/api/v1`.
 * @param {{ method?: string, body?: object }} [options]
 * @returns {Promise<any>}
 * @throws {Error} Con `code` cuando la API responde con error.
 */
async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await authFetch(path, { method, body });
  } catch {
    throw new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code, message, details } = data.error ?? {};
    const err = new Error(
      code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED'
        ? 'Tu sesión venció. Inicia sesión de nuevo.'
        : details?.[0]?.problem || message || 'Algo salió mal. Inténtalo de nuevo.',
    );
    err.code = code;
    throw err;
  }
  return data;
}

/**
 * Llave pública VAPID que el navegador necesita para suscribirse (`GET /push/vapid-public-key`).
 * @returns {Promise<string>}
 */
export async function getVapidPublicKey() {
  const { key } = await request('/push/vapid-public-key');
  return key;
}

/**
 * Registra la suscripción de este dispositivo (`POST /push/subscribe`).
 * @param {PushSubscriptionJSON} subscription Resultado de `subscription.toJSON()`.
 * @returns {Promise<void>}
 */
export async function registerSubscription(subscription) {
  await request('/push/subscribe', { method: 'POST', body: { subscription } });
}

/**
 * Elimina la suscripción de este dispositivo (`DELETE /push/subscribe`).
 * Si el servidor ya no la tenía (404) se considera eliminada.
 * @param {string} endpoint
 * @returns {Promise<void>}
 */
export async function removeSubscription(endpoint) {
  try {
    await request('/push/subscribe', { method: 'DELETE', body: { endpoint } });
  } catch (err) {
    if (err.code !== 'NOT_FOUND') throw err;
  }
}

/**
 * Da de baja las notificaciones de este dispositivo, en el servidor y en el navegador.
 * Se usa al cerrar sesión para que el siguiente usuario no reciba avisos de la cuenta anterior.
 * @returns {Promise<void>}
 */
export async function unsubscribeThisDevice() {
  if (!isPushSupported()) return;
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await removeSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

/**
 * Hora y zona horaria del recordatorio diario (`GET /users/me/reminder-settings`).
 * @returns {Promise<ReminderSettings>}
 */
export function getReminderSettings() {
  return request('/users/me/reminder-settings');
}

/**
 * Guarda el recordatorio diario (`PUT /users/me/reminder-settings`); `time: null` lo desactiva.
 * @param {ReminderSettings} settings
 * @returns {Promise<ReminderSettings>}
 */
export function saveReminderSettings(settings) {
  return request('/users/me/reminder-settings', { method: 'PUT', body: settings });
}
