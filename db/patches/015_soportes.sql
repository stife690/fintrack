-- FinTrack — parche 015: soportes de pago (FT-0044). Foto o PDF adjunto a un movimiento.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- El archivo no se guarda aquí: vive en el disco (desarrollo) o en el espacio privado de Supabase
-- (producción), en `ruta`. Esta tabla dice de quién es y de qué movimiento.
CREATE TABLE IF NOT EXISTS transaccion_soportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaccion_id UUID NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(120) NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('image/jpeg','image/png','image/webp','application/pdf')),
  tamano INTEGER NOT NULL CHECK (tamano > 0),
  ruta VARCHAR(200) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transaccion_soportes_transaccion
  ON transaccion_soportes(transaccion_id, created_at);
