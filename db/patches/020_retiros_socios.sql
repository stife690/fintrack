-- FT-0018 (Emprendimientos, entrega 3): retiros de los socios.
-- Un retiro sale del negocio (tipo 'retiro') y entra como ingreso en las finanzas personales del
-- socio que lo hizo (transaccion_id). No cuenta como gasto: no baja la utilidad del negocio.
-- Idempotente: se puede ejecutar varias veces.
ALTER TABLE negocio_movimientos DROP CONSTRAINT IF EXISTS negocio_movimientos_tipo_check;
ALTER TABLE negocio_movimientos ADD CONSTRAINT negocio_movimientos_tipo_check
  CHECK (tipo IN ('venta', 'costo_venta', 'gasto_fijo', 'gasto_variable', 'otro_ingreso', 'retiro'));
ALTER TABLE negocio_movimientos ADD COLUMN IF NOT EXISTS transaccion_id UUID NULL
  REFERENCES transacciones(id) ON DELETE SET NULL;
