import { createApp } from './app.js';
import { env } from './config/env.js';
import { createReminderScheduler } from './services/reminder-scheduler.service.js';

/**
 * Punto de entrada del backend: arranca el servidor HTTP y el programador del
 * recordatorio diario (REQ-030). El puerto viene de `PORT` (lo define Render) o 3000 por defecto.
 */
createApp().listen(env.port, () => {
  console.log(`FinTrack API escuchando en el puerto ${env.port}`);
});

if (!env.remindersEnabled) {
  console.log('Recordatorios push desactivados (REMINDERS_ENABLED=false)');
} else if (!env.vapidPublicKey || !env.vapidPrivateKey) {
  console.log('Recordatorios push desactivados: faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY');
} else {
  createReminderScheduler({ intervalMs: env.reminderCheckIntervalMs }).start();
  console.log('Programador de recordatorios push iniciado');
}
