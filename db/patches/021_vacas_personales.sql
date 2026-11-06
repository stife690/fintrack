-- Metas personales: una vaca de una sola persona (sin invitar, sin cuotas ni código para unirse).
-- Sale en "Metas" y no en "En grupo". Idempotente: se puede ejecutar varias veces.
ALTER TABLE vacas ADD COLUMN IF NOT EXISTS personal BOOLEAN NOT NULL DEFAULT false;
