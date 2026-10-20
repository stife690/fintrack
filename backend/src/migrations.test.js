import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './config/db.js';
import { MIGRATIONS, runMigrations } from './config/migrations.js';

// Usa la base real; sin el esquema de db/init/ se omite con un aviso.
const { rows } = await pool.query("SELECT to_regclass('public.usuarios') AS tabla");
const options = { skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql' };

after(() => pool.end());

/** @returns {Promise<boolean>} */
async function columnExists(table, column) {
  const { rows: found } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return found.length > 0;
}

test('runMigrations deja las columnas de los parches y se puede correr dos veces', options, async () => {
  assert.deepEqual(await runMigrations(), MIGRATIONS.map((m) => m.id));
  assert.deepEqual(await runMigrations(), MIGRATIONS.map((m) => m.id), 'es idempotente');
  assert.ok(await columnExists('transacciones', 'local_id'));
  assert.ok(await columnExists('usuarios', 'nombre'));
  assert.ok(await columnExists('usuarios', 'reminder_times'));
});

test('runMigrations no hace nada si la base no tiene el esquema', async () => {
  const fakeDb = {
    queries: [],
    async query(sql) {
      this.queries.push(sql);
      return { rows: [{ tabla: null }] };
    },
  };
  assert.deepEqual(await runMigrations(fakeDb), []);
  assert.equal(fakeDb.queries.length, 1, 'solo consulta si existe la tabla');
});
