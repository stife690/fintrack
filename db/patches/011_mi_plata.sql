-- FinTrack — parche 011: Mi plata (FT-0036). Cómo le entra la plata a cada usuario y sus compromisos.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Una fila por usuario, desde que responde u omite la bienvenida. `saldo_at` es el momento en que
-- dijo cuánta plata tenía: lo registrado después se suma o se resta de ese saldo.
CREATE TABLE IF NOT EXISTS perfiles_financieros (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_ingreso VARCHAR(10) NULL CHECK (tipo_ingreso IN ('fecha_fija','sin_fecha')),
  dias_pago SMALLINT[] NOT NULL DEFAULT '{}',
  saldo_inicial NUMERIC(12,2) NULL CHECK (saldo_inicial IS NULL OR saldo_inicial >= 0),
  saldo_at TIMESTAMPTZ NULL,
  bienvenida_at TIMESTAMPTZ NULL, -- cuándo respondió u omitió la bienvenida: no se vuelve a mostrar
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pagos que se repiten cada mes. `dia_mes` 31 cae el último día en los meses más cortos.
CREATE TABLE IF NOT EXISTS compromisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(60) NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  dia_mes SMALLINT NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- El nombre identifica el pago en los movimientos del mes: no se repite por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS ux_compromisos_usuario_nombre ON compromisos(usuario_id, lower(nombre));
