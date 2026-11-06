-- FinTrack — parche 022: versión y fecha en que cada persona aceptó los términos y la política de
-- privacidad (FT-0017). NULL: aún no los ha aceptado (cuentas creadas antes de publicarlos).
-- Idempotente. El backend lo aplica solo al arrancar (backend/src/config/migrations.js).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terminos_version VARCHAR(10) NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terminos_aceptados_at TIMESTAMPTZ NULL;
