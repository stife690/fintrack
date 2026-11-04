-- FT-0047: pagos que llegan desde Atajos del iPhone (Apple Pay) y esperan que el usuario los confirme.
-- atajo_tokens: un token personal por usuario; solo se guarda su hash SHA-256, nunca el token.
-- pagos_por_confirmar: lo que mandó el Atajo. Nada entra a transacciones hasta confirmarlo.
-- llave evita guardar dos veces el mismo pago si el Atajo reintenta.
-- Idempotente: se puede ejecutar varias veces.
CREATE TABLE IF NOT EXISTS atajo_tokens (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS pagos_por_confirmar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  comercio VARCHAR(80) NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL,
  tarjeta VARCHAR(40) NULL,
  llave CHAR(64) NOT NULL,
  estado VARCHAR(11) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmado', 'descartado')),
  transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, llave)
);
CREATE INDEX IF NOT EXISTS idx_pagos_por_confirmar_usuario
  ON pagos_por_confirmar(usuario_id, estado, created_at DESC);
