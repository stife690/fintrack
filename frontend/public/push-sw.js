/*
 * Manejadores de notificaciones push (FT-0011). `vite-plugin-pwa` genera el service worker
 * principal (caché y modo offline) y lo importa con `importScripts('push-sw.js')`, así que
 * estos eventos conviven con el caché sin tocarlo.
 */

const DEFAULT_URL = '/app/transacciones';

/** Muestra la notificación cuando el servidor envía un push (`{ title, body, url }`). */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'FinTrack';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Con la misma etiqueta, un recordatorio nuevo reemplaza al anterior en vez de apilarse.
      tag: 'fintrack-reminder',
      data: { url: payload.url || DEFAULT_URL },
    }),
  );
});

/** Al tocar la notificación abre FinTrack: reutiliza una pestaña abierta o crea una nueva. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Solo se navega dentro de este origen, aunque el mensaje traiga otra dirección.
  const target = new URL(event.notification.data?.url || DEFAULT_URL, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + DEFAULT_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) return open.focus().then((client) => client.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
