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
  {
    id: '007_vacas',
    statements: [
      `CREATE TABLE IF NOT EXISTS vacas (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         nombre VARCHAR(60) NOT NULL,
         descripcion VARCHAR(200) NULL,
         meta NUMERIC(12,2) NOT NULL CHECK (meta > 0),
         fecha_limite DATE NULL,
         reparto VARCHAR(15) NOT NULL DEFAULT 'igual' CHECK (reparto IN ('igual','personalizado')),
         codigo VARCHAR(8) UNIQUE NOT NULL,
         creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         consejo TEXT NULL,
         consejo_total NUMERIC(12,2) NULL,
         consejo_at TIMESTAMPTZ NULL,
         recordatorio_at TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS vaca_miembros (
         vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         rol VARCHAR(10) NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin','miembro')),
         cuota NUMERIC(12,2) NULL CHECK (cuota IS NULL OR cuota >= 0),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (vaca_id, usuario_id)
       )`,
      'CREATE INDEX IF NOT EXISTS idx_vaca_miembros_usuario ON vaca_miembros(usuario_id)',
      `CREATE TABLE IF NOT EXISTS vaca_invitaciones (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
         email VARCHAR(255) NOT NULL,
         invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_vaca_invitaciones_email
         ON vaca_invitaciones(vaca_id, lower(email))`,
      `CREATE TABLE IF NOT EXISTS vaca_aportes (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
         usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
         nota VARCHAR(120) NULL,
         fecha DATE NOT NULL,
         transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
         local_id VARCHAR(64) NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         deleted_at TIMESTAMPTZ NULL
       )`,
      'CREATE INDEX IF NOT EXISTS idx_vaca_aportes_vaca ON vaca_aportes(vaca_id, created_at DESC)',
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_vaca_aportes_usuario_local
         ON vaca_aportes(usuario_id, local_id) WHERE local_id IS NOT NULL`,
    ],
  },
  {
    id: '008_negocios',
    statements: [
      `CREATE TABLE IF NOT EXISTS negocios (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         nombre VARCHAR(60) NOT NULL,
         descripcion VARCHAR(200) NULL,
         nit VARCHAR(20) NULL,
         codigo VARCHAR(8) UNIQUE NOT NULL,
         creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS negocio_socios (
         negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
         participacion NUMERIC(5,2) NULL
           CHECK (participacion IS NULL OR (participacion >= 0 AND participacion <= 100)),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (negocio_id, usuario_id)
       )`,
      'CREATE INDEX IF NOT EXISTS idx_negocio_socios_usuario ON negocio_socios(usuario_id)',
      `CREATE TABLE IF NOT EXISTS negocio_invitaciones (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
         email VARCHAR(255) NOT NULL,
         rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
         invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_negocio_invitaciones_email
         ON negocio_invitaciones(negocio_id, lower(email))`,
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
