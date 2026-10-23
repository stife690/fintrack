/**
 * Utilidades del navegador para Web Push (FT-0011). No hablan con la API: solo con
 * `Notification`, `PushManager` y el service worker.
 */

/** Tiempo máximo de espera a que el service worker esté listo, en ms. */
const READY_TIMEOUT_MS = 5000;

/**
 * Indica si este navegador permite notificaciones push. En iPhone solo ocurre con la
 * app instalada en la pantalla de inicio; en desarrollo hace falta el service worker.
 * @returns {boolean}
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Convierte la llave pública VAPID (base64 URL-safe) al formato que pide `PushManager.subscribe`.
 * @param {string} base64 Llave en base64 URL-safe, sin relleno.
 * @returns {Uint8Array}
 */
export function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/**
 * Espera a que el service worker esté activo. Si no hay uno registrado (p. ej. en
 * desarrollo, donde el PWA está apagado) no se queda esperando para siempre.
 * @returns {Promise<ServiceWorkerRegistration>}
 * @throws {Error} Si el service worker no estuvo listo a tiempo.
 */
export async function getReadyRegistration() {
  const timeout = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error('Las notificaciones no están listas todavía. Recarga la página e inténtalo de nuevo.')),
      READY_TIMEOUT_MS,
    );
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** Espera antes de reintentar una suscripción que el servicio push rechazó, en ms. */
const RETRY_DELAY_MS = 1000;

/**
 * Suscribe el dispositivo al servicio push del navegador. Reintenta una vez si el servicio
 * falla (`AbortError`, a veces pasajero en Chrome de escritorio) y reemplaza una suscripción
 * vieja hecha con otra llave VAPID (`InvalidStateError`).
 * @param {ServiceWorkerRegistration} registration
 * @param {string} key Llave pública VAPID en base64 URL-safe.
 * @returns {Promise<PushSubscription>}
 */
export async function subscribePush(registration, key) {
  const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) };
  try {
    return await registration.pushManager.subscribe(options);
  } catch (err) {
    if (err?.name === 'InvalidStateError') {
      const old = await registration.pushManager.getSubscription();
      await old?.unsubscribe();
    } else if (err?.name === 'AbortError') {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } else {
      throw err;
    }
    return registration.pushManager.subscribe(options);
  }
}

/**
 * Texto para el usuario de un error al activar las notificaciones. Los errores del navegador
 * llegan en inglés («Registration failed - push service error»); se explican en español.
 * @param {unknown} err
 * @returns {string}
 */
export function pushErrorMessage(err) {
  switch (err?.name) {
    case 'AbortError':
      return (
        'Tu navegador no pudo conectarse con su servicio de notificaciones. En Brave, activa ' +
        '«Usar los servicios de Google para mensajería push» en Configuración → Privacidad y seguridad. ' +
        'Si usas VPN, antivirus o un bloqueador de anuncios, pausa el bloqueo e inténtalo de nuevo.'
      );
    case 'NotAllowedError':
      return 'El navegador no permitió las notificaciones. Revisa los permisos del sitio (el candado junto a la dirección).';
    case 'NotSupportedError':
      return 'Este navegador no permite notificaciones push.';
    default:
      return err?.message || 'No se pudieron activar las notificaciones. Inténtalo de nuevo.';
  }
}

/**
 * Suscripción push actual de este dispositivo, o `null` si no hay (sin esperar al service worker).
 * @returns {Promise<PushSubscription|null>}
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * Zona horaria IANA del dispositivo (p. ej. `America/Bogota`).
 * @returns {string}
 */
export function getDeviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
}
