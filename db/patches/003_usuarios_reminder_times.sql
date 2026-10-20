-- FinTrack — parche 003: varios recordatorios al día.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.
--
-- usuarios.reminder_times guarda todas las horas del recordatorio (hasta 5). La columna anterior,
-- reminder_time, se copia a la nueva una sola vez y se deja en NULL; ya no se usa.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reminder_times TIME[] NOT NULL DEFAULT '{}';

UPDATE usuarios
   SET reminder_times = ARRAY[reminder_time], reminder_time = NULL
 WHERE reminder_time IS NOT NULL;
