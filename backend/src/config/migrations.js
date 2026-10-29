import { pool } from './db.js';

/**
 * Parches de esquema para bases ya creadas (Supabase y volúmenes locales existentes).
 * Son el mismo SQL que `db/patches/`; las bases nuevas ya los traen en `db/init/`.
 * Todos son idempotentes, así que correrlos en cada arranque no cambia nada si ya están.
 * Para agregar uno: escribir `db/patches/NNN_*.sql` y copiar aquí sus sentencias.
 */
export const MIGRATIONS = [
  {
    id: '001_transacciones_local_id',
    statements: [
      'ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS local_id VARCHAR(64) NULL',
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_transacciones_usuario_local
         ON transacciones(usuario_id, local_id) WHERE local_id IS NOT NULL`,
    ],
  },
  {
    id: '002_usuarios_nombre',
    statements: ['ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre VARCHAR(60) NULL'],
  },
  {
    id: '003_usuarios_reminder_times',
    statements: [
      "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reminder_times TIME[] NOT NULL DEFAULT '{}'",
      `UPDATE usuarios
          SET reminder_times = ARRAY[reminder_time], reminder_time = NULL
        WHERE reminder_time IS NOT NULL`,
    ],
  },
  {
    id: '004_password_reset_tokens',
    statements: [
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         token_hash VARCHAR(64) UNIQUE NOT NULL,
         expires_at TIMESTAMPTZ NOT NULL,
         used_at TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario
         ON password_reset_tokens(usuario_id)`,
    ],
  },
  {
    id: '005_categorias_propias',
    statements: [
      `DO $$
       BEGIN
         IF (SELECT data_type FROM information_schema.columns
              WHERE table_name = 'categorias' AND column_name = 'id') = 'smallint' THEN
           ALTER TABLE transacciones ALTER COLUMN categoria_id TYPE INTEGER;
           ALTER TABLE presupuestos ALTER COLUMN categoria_id TYPE INTEGER;
           ALTER TABLE categorias ALTER COLUMN id TYPE INTEGER;
         END IF;
       END $$`,
      'CREATE SEQUENCE IF NOT EXISTS categorias_id_seq START 1000 OWNED BY categorias.id',
      "ALTER TABLE categorias ALTER COLUMN id SET DEFAULT nextval('categorias_id_seq')",
      'ALTER TABLE categorias ADD COLUMN IF NOT EXISTS usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE',
      'ALTER TABLE categorias ADD COLUMN IF NOT EXISTS icono VARCHAR(30) NULL',
      'ALTER TABLE categorias ADD COLUMN IF NOT EXISTS color VARCHAR(20) NULL',
      'ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_key',
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_categorias_usuario_nombre
         ON categorias (COALESCE(usuario_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre))`,
      `CREATE INDEX IF NOT EXISTS idx_categorias_usuario
         ON categorias(usuario_id) WHERE usuario_id IS NOT NULL`,
    ],
  },
  {
    id: '006_insights_por_semana',
    statements: [
      `DO $$
       BEGIN
         IF (SELECT data_type FROM information_schema.columns
              WHERE table_name = 'insights' AND column_name = 'mes') = 'character' THEN
           ALTER TABLE insights ALTER COLUMN mes TYPE VARCHAR(10);
         END IF;
       END $$`,
    ],
  },
];

/**
 * Aplica los parches pendientes antes de atender peticiones. Si la base todavía no tiene el
 * esquema (p. ej. una base vacía en CI) no hace nada: eso lo crea `db/init/`.
 * @param {import('pg').Pool} [db]
 * @returns {Promise<string[]>} Ids de los parches revisados, o `[]` si no hay esquema.
 */
export async function runMigrations(db = pool) {
  const { rows } = await db.query("SELECT to_regclass('public.usuarios') AS tabla");
  if (!rows[0].tabla) return [];
  for (const { statements } of MIGRATIONS) {
    for (const sql of statements) await db.query(sql);
  }
  return MIGRATIONS.map((m) => m.id);
}
