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
