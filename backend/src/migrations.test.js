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

test(
  'runMigrations deja las columnas de los parches y se puede correr dos veces',
  options,
  async () => {
    assert.deepEqual(
      await runMigrations(),
      MIGRATIONS.map((m) => m.id),
    );
    assert.deepEqual(
      await runMigrations(),
      MIGRATIONS.map((m) => m.id),
      'es idempotente',
    );
    assert.ok(await columnExists('transacciones', 'local_id'));
    assert.ok(await columnExists('usuarios', 'nombre'));
    assert.ok(await columnExists('usuarios', 'reminder_times'));
  },
);

test('el parche 014 crea tarjetas y es idempotente', options, async () => {
  await runMigrations();
  await runMigrations();
  assert.ok(await columnExists('transacciones', 'tarjeta_id'));
  assert.ok(await columnExists('transacciones', 'cuotas'));
  assert.ok(await columnExists('usuarios', 'recordar_tarjetas'));
  const { rows: tablas } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [['tarjetas', 'pagos_tarjeta', 'ajustes_tarjeta']],
  );
  assert.equal(tablas.length, 3);
});

test('RLS queda activo en todas las tablas y el backend sigue leyendo', options, async () => {
  await runMigrations();
  const { rows: sinRls } = await pool.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
  );
  assert.deepEqual(
    sinRls.map((r) => r.relname),
    [],
    'tablas sin RLS',
  );
  // El backend es el dueño de las tablas: sin FORCE, RLS no lo frena.
  const { rows: count } = await pool.query('SELECT count(*)::int AS n FROM categorias');
  assert.ok(count[0].n > 0);
});

test('RLS también cubre una tabla creada por un parche posterior', options, async () => {
  await pool.query('CREATE TABLE IF NOT EXISTS rls_tabla_nueva (id int)');
  try {
    await runMigrations();
    const { rows: tabla } = await pool.query(
      "SELECT relrowsecurity FROM pg_class WHERE relname = 'rls_tabla_nueva'",
    );
    assert.equal(tabla[0].relrowsecurity, true);
  } finally {
    await pool.query('DROP TABLE IF EXISTS rls_tabla_nueva');
  }
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
