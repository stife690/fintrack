-- FinTrack — parche 014: tarjetas de crédito (cupo, deuda, pagos y ajustes con el banco).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.
-- Nunca se guarda el número completo, el CVV ni el vencimiento: solo los últimos 4 dígitos.

CREATE TABLE IF NOT EXISTS tarjetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(40) NOT NULL,
  franquicia VARCHAR(10) NOT NULL CHECK (franquicia IN ('visa','mastercard','amex','otra')),
  nivel VARCHAR(10) NOT NULL,
  ultimos4 CHAR(4) NOT NULL CHECK (ultimos4 ~ '^[0-9]{4}$'),
  cupo_total NUMERIC(12,2) NOT NULL CHECK (cupo_total > 0),
  deuda_base NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deuda_base >= 0), -- deuda al crearla o ajustarla
  base_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- desde cuándo cuentan los cargos y pagos sobre deuda_base
  dia_pago SMALLINT NOT NULL CHECK (dia_pago BETWEEN 1 AND 31),
  dia_corte SMALLINT NULL CHECK (dia_corte BETWEEN 1 AND 31),
  total_extracto NUMERIC(12,2) NULL CHECK (total_extracto >= 0),
  fecha_limite_extracto DATE NULL,
  recordatorio_enviado_para DATE NULL, -- fecha de pago ya avisada: evita repetir el push
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT tarjetas_nivel_check CHECK (
    (franquicia IN ('visa','mastercard') AND nivel IN ('clasica','gold','platinum','black'))
    OR (franquicia = 'amex' AND nivel IN ('green','blue','gold','platinum'))
    OR (franquicia = 'otra' AND nivel = 'clasica'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tarjetas_usuario_ultimos4
  ON tarjetas(usuario_id, ultimos4) WHERE deleted_at IS NULL;

ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS tarjeta_id UUID NULL REFERENCES tarjetas(id);
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS cuotas SMALLINT NULL CHECK (cuotas BETWEEN 1 AND 48);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacciones_tarjeta_solo_gasto') THEN
    ALTER TABLE transacciones ADD CONSTRAINT transacciones_tarjeta_solo_gasto
      CHECK (tarjeta_id IS NULL OR tipo = 'gasto');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_transacciones_tarjeta
  ON transacciones(tarjeta_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pagos_tarjeta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tarjeta_id UUID NOT NULL REFERENCES tarjetas(id),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_pagos_tarjeta_tarjeta
  ON pagos_tarjeta(tarjeta_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ajustes_tarjeta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tarjeta_id UUID NOT NULL REFERENCES tarjetas(id),
  diferencia NUMERIC(12,2) NOT NULL CHECK (diferencia <> 0),
  transaccion_id UUID NULL REFERENCES transacciones(id), -- gasto creado cuando el banco cobró de más
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ajustes_tarjeta_tarjeta ON ajustes_tarjeta(tarjeta_id);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recordar_tarjetas BOOLEAN NOT NULL DEFAULT true;
