-- FinTrack — parche 010: registro por WhatsApp (FT-0029). Números vinculados y mensajes procesados.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Una fila por usuario. `telefono` es NULL hasta que envía su código al bot; del código de un solo
-- uso solo se guarda el hash.
CREATE TABLE IF NOT EXISTS whatsapp_vinculos (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  telefono VARCHAR(20) UNIQUE NULL,
  codigo_hash VARCHAR(64) UNIQUE NULL,
  codigo_expira TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta puede reenviar un mensaje: la llave primaria impide procesarlo dos veces. No guarda el texto.
CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
  mensaje_id VARCHAR(128) PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_usuario
  ON whatsapp_mensajes(usuario_id, created_at DESC);
