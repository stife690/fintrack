-- FinTrack — parche 005: categorías propias de cada usuario (cambio de RN-02 aprobado por el equipo).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.
--
-- Las 15 categorías de siempre quedan igual (usuario_id NULL: son de todos). Las de un usuario
-- llevan su usuario_id, un ícono y un color, y su id sale de una secuencia que empieza en 1000.
-- El id pasa de SMALLINT a INTEGER: SMALLINT se quedaría corto con muchos usuarios.

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_name = 'categorias' AND column_name = 'id') = 'smallint' THEN
    ALTER TABLE transacciones ALTER COLUMN categoria_id TYPE INTEGER;
    ALTER TABLE presupuestos ALTER COLUMN categoria_id TYPE INTEGER;
    ALTER TABLE categorias ALTER COLUMN id TYPE INTEGER;
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS categorias_id_seq START 1000 OWNED BY categorias.id;
ALTER TABLE categorias ALTER COLUMN id SET DEFAULT nextval('categorias_id_seq');

ALTER TABLE categorias ADD COLUMN IF NOT EXISTS usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS icono VARCHAR(30) NULL;
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS color VARCHAR(20) NULL;

-- El nombre ya no es único en toda la tabla: es único entre las globales y las de cada usuario.
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_categorias_usuario_nombre
  ON categorias (COALESCE(usuario_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON categorias(usuario_id) WHERE usuario_id IS NOT NULL;
