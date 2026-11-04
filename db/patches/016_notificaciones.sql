-- FinTrack — parche 016: centro de notificaciones (FT-0045).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Bandeja de avisos: queda todo lo que se envía por push (vacas, negocios, tarjetas, presupuestos)
-- aunque el usuario no tenga push activo. `leida_at` NULL: aún no la ha visto.
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(120) NOT NULL,
  cuerpo VARCHAR(300) NOT NULL,
  url VARCHAR(200) NULL,
  leida_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, created_at DESC);

-- Un presupuesto avisa una sola vez por nivel (80 % y 100 %): la fila en `alertas` es la marca.
CREATE UNIQUE INDEX IF NOT EXISTS ux_alertas_presupuesto_nivel ON alertas(presupuesto_id, nivel);
