import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './config/migrations.js';
import { createReminderScheduler } from './services/reminder-scheduler.service.js';

/**
 * Punto de entrada del backend: aplica los parches de la base, arranca el servidor HTTP y el
 * programador del recordatorio diario (REQ-030). El puerto viene de `PORT` (lo define Render) o 3000.
 */
try {
  const applied = await runMigrations();
  if (applied.length) console.log(`Esquema al día (parches: ${applied.join(', ')})`);
} catch (err) {
  // Sin base de datos el servidor igual arranca: /health lo reporta y se puede revisar.
  console.error('No se pudieron aplicar los parches de la base:', err.message);
}

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
