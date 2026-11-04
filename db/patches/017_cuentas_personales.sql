-- FT-0046: cuentas personales por cobrar ("me deben") y por pagar ("debo").
-- Son una lista para recordar: no suman ni restan de Mi plata. Al saldarla se puede crear el
-- ingreso o el gasto, que queda enlazado en transaccion_id.
-- Idempotente: se puede ejecutar varias veces.
CREATE TABLE IF NOT EXISTS cuentas_personales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('por_cobrar', 'por_pagar')),
  persona VARCHAR(60) NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha_limite DATE NULL,
  nota VARCHAR(200) NULL,
  saldada_at TIMESTAMPTZ NULL,
  transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
  recordatorio_enviado BOOLEAN NOT NULL DEFAULT false, -- ya se avisó un día antes de fecha_limite
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cuentas_personales_usuario
  ON cuentas_personales(usuario_id, saldada_at, fecha_limite);
