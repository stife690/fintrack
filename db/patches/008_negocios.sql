-- FinTrack — parche 008: Emprendimientos (FT-0016). Negocios que comparten varias personas, sus
-- socios con rol y participación, y las invitaciones por correo.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

CREATE TABLE IF NOT EXISTS negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(200) NULL,
  nit VARCHAR(20) NULL,
  codigo VARCHAR(8) UNIQUE NOT NULL, -- código de invitación (enlace /app/negocios/unirse/<codigo>)
  creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dueño: administra el negocio y sus socios · editor: registra movimientos · lector: solo ve.
CREATE TABLE IF NOT EXISTS negocio_socios (
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
  participacion NUMERIC(5,2) NULL CHECK (participacion IS NULL OR (participacion >= 0 AND participacion <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_negocio_socios_usuario ON negocio_socios(usuario_id);

-- El rol con el que entra quien acepta la invitación por correo.
CREATE TABLE IF NOT EXISTS negocio_invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
  invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_negocio_invitaciones_email ON negocio_invitaciones(negocio_id, lower(email));
