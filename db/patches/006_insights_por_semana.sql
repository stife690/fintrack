-- FinTrack — parche 006: consejos con IA desde la primera semana (cambio de REQ-021 aprobado por el equipo).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.
--
-- insights.mes identifica el periodo de los consejos guardados: el mes (AAAA-MM) o, desde este
-- parche, el lunes de la semana (AAAA-MM-DD). Por eso pasa de CHAR(7) a VARCHAR(10).

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_name = 'insights' AND column_name = 'mes') = 'character' THEN
    ALTER TABLE insights ALTER COLUMN mes TYPE VARCHAR(10);
  END IF;
END $$;
