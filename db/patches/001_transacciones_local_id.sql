-- Parche para bases de datos ya creadas (Docker local con volumen existente y Supabase).
-- db/init/01_schema.sql ya incluye estos cambios para las bases nuevas.
-- Es idempotente: se puede ejecutar varias veces sin error.
--
-- Agrega transacciones.local_id: el id de IndexedDB de las transacciones creadas offline,
-- para que POST /sync/batch no las duplique si un lote se reenvía (FT-0009).
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS local_id VARCHAR(64) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_transacciones_usuario_local
  ON transacciones(usuario_id, local_id) WHERE local_id IS NOT NULL;
