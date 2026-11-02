-- FinTrack — parche 012: Mi plata toma la plata de los movimientos, salvo que el usuario la corrija.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Quien aún no tiene ingresos registrados conserva el saldo que escribió: sus movimientos no dicen
-- cuánta plata tiene. El UPDATE corre solo la vez que se crea la columna.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'perfiles_financieros' AND column_name = 'saldo_corregido') THEN
    ALTER TABLE perfiles_financieros ADD COLUMN saldo_corregido BOOLEAN NOT NULL DEFAULT false;
    UPDATE perfiles_financieros p SET saldo_corregido = true
     WHERE p.saldo_inicial IS NOT NULL AND COALESCE((
       SELECT SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto ELSE -t.monto END)
         FROM transacciones t WHERE t.usuario_id = p.usuario_id AND t.deleted_at IS NULL), 0) <= 0;
  END IF;
END $$;
