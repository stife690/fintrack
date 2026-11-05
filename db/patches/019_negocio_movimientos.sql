-- FT-0017 (Emprendimientos, entrega 2): movimientos del negocio, separados de los personales.
-- tipo: venta e otro_ingreso entran; costo_venta, gasto_fijo y gasto_variable salen.
-- usuario_id es quién lo registró (queda NULL si esa persona borra su cuenta).
-- local_id evita registrar dos veces el mismo movimiento si el celular reenvía la petición.
-- Idempotente: se puede ejecutar varias veces.
CREATE TABLE IF NOT EXISTS negocio_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(14) NOT NULL
    CHECK (tipo IN ('venta', 'costo_venta', 'gasto_fijo', 'gasto_variable', 'otro_ingreso')),
  categoria VARCHAR(20) NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  descripcion VARCHAR(120) NOT NULL,
  fecha DATE NOT NULL,
  local_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_negocio_movimientos_fecha ON negocio_movimientos(negocio_id, fecha DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_negocio_movimientos_local
  ON negocio_movimientos(negocio_id, local_id) WHERE local_id IS NOT NULL;
