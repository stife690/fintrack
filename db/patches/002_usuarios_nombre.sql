-- FinTrack — parche 002: nombre visible del usuario (opcional).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre VARCHAR(60) NULL;
