-- FinTrack — parche 007: La Vaca Inteligente (FT-0014). Grupos con una meta de ahorro común,
-- sus miembros, las invitaciones por correo y los aportes de cada miembro.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

CREATE TABLE IF NOT EXISTS vacas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(200) NULL,
  meta NUMERIC(12,2) NOT NULL CHECK (meta > 0),
  fecha_limite DATE NULL,
  reparto VARCHAR(15) NOT NULL DEFAULT 'igual' CHECK (reparto IN ('igual','personalizado')),
  codigo VARCHAR(8) UNIQUE NOT NULL, -- código de invitación (enlace /app/vacas/unirse/<codigo>)
  creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  consejo TEXT NULL, -- último consejo generado (IA o reglas), se reutiliza mientras no cambie el total
  consejo_total NUMERIC(12,2) NULL,
  consejo_at TIMESTAMPTZ NULL,
  recordatorio_at TIMESTAMPTZ NULL, -- último recordatorio push a los atrasados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vaca_miembros (
  vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol VARCHAR(10) NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin','miembro')),
  cuota NUMERIC(12,2) NULL CHECK (cuota IS NULL OR cuota >= 0), -- solo con reparto personalizado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vaca_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_vaca_miembros_usuario ON vaca_miembros(usuario_id);

CREATE TABLE IF NOT EXISTS vaca_invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vaca_invitaciones_email ON vaca_invitaciones(vaca_id, lower(email));

-- Cada aporte también queda como un gasto del miembro (transaccion_id). Si el miembro borra su
-- cuenta, el aporte se conserva para el total del grupo (usuario_id queda en NULL).
CREATE TABLE IF NOT EXISTS vaca_aportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  nota VARCHAR(120) NULL,
  fecha DATE NOT NULL,
  transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
  local_id VARCHAR(64) NULL, -- id del dispositivo: reenviar un aporte hecho sin conexión no lo duplica
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_vaca_aportes_vaca ON vaca_aportes(vaca_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vaca_aportes_usuario_local
  ON vaca_aportes(usuario_id, local_id) WHERE local_id IS NOT NULL;
