-- FinTrack — parche 013: verificar el correo al registrarse (FT-0016).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Las cuentas que ya existían quedan verificadas para no dejar a nadie por fuera. El UPDATE corre
-- solo la vez que se crea la columna: las cuentas nuevas empiezan sin verificar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'usuarios' AND column_name = 'email_verificado_at') THEN
    ALTER TABLE usuarios ADD COLUMN email_verificado_at TIMESTAMPTZ NULL;
    UPDATE usuarios SET email_verificado_at = now();
  END IF;
END $$;

-- Enlaces del correo de verificación. Igual que password_reset_tokens: solo se guarda el sha256.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_usuario
  ON email_verification_tokens(usuario_id);
