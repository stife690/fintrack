-- FinTrack — parche 009: Lo que viene (FT-0026). Ideas que envían los usuarios y sus votos.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- revision: recién enviada, solo la ve el equipo · planeada y en_progreso: públicas, se votan ·
-- lista: ya disponible · descartada: no se muestra. El equipo cambia el estado con SQL.
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo VARCHAR(120) NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'revision'
    CHECK (estado IN ('revision','planeada','en_progreso','lista','descartada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ideas_estado ON ideas(estado);
CREATE INDEX IF NOT EXISTS idx_ideas_usuario ON ideas(usuario_id, created_at DESC);

-- Un voto por persona: la llave primaria impide votar dos veces.
CREATE TABLE IF NOT EXISTS idea_votos (
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, usuario_id)
);
