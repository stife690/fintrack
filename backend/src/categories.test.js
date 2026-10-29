import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { MAX_OWN_CATEGORIES, newCategoryKey } from './services/categories.service.js';

// Estas pruebas usan la base de datos real con el parche 005 (columna categorias.usuario_id).
// Si falta, se omiten con un aviso en vez de fallar.
const { rows } = await pool.query(
  `SELECT 1 FROM information_schema.columns
   WHERE table_name = 'categorias' AND column_name = 'usuario_id'`,
);
const options = {
  skip: rows.length > 0 ? false : 'Esquema sin el parche 005: ejecuta db/patches/005 o db/init',
};

const TEST_DOMAIN = '@categories-test.fintrack.test';

// Borra los usuarios de prueba; sus categorías, presupuestos y movimientos caen por ON DELETE CASCADE.
after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Cliente de prueba: hace una petición a la API y devuelve el código y el cuerpo.
 * @typedef {(path: string, init?: { method?: string, body?: unknown, token?: string }) => Promise<{ status: number, body: object }>} Api
 */

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor. La IA queda apagada:
 * estas pruebas no dependen de que haya una clave en el `.env`.
 * @param {(api: Api) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
  const previousKey = env.aiApiKey;
  env.aiApiKey = undefined;
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  try {
    await fn(api);
  } finally {
    server.close();
    env.aiApiKey = previousKey;
  }
}

/**
 * Registra un usuario nuevo y devuelve su access token.
 * @param {Api} api
 * @returns {Promise<string>}
 */
async function newUserToken(api) {
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' },
  });
  return body.accessToken;
}

/**
 * Crea una categoría propia y devuelve la respuesta.
 * @param {Api} api
 * @param {string} token
 * @param {object} [overrides]
 * @returns {Promise<{ status: number, body: object }>}
 */
function createCategory(api, token, overrides = {}) {
  return api('/categories', {
    method: 'POST',
    token,
    body: { name: 'Mascotas', type: 'gasto', icon: 'paw-print', color: 'amber', ...overrides },
  });
}

test('newCategoryKey: claves "c_" de 10 caracteres que no chocan con las de todos', () => {
  const keys = new Set(Array.from({ length: 200 }, newCategoryKey));
  assert.equal(keys.size, 200);
  for (const key of keys) assert.match(key, /^c_[a-z0-9]{10}$/);
});

test(
  'sin categorías propias se ven las 15 de todos, marcadas como no propias',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const { status, body } = await api('/categories', { token });
      assert.equal(status, 200);
      assert.equal(body.expense.length + body.income.length, 15);
      assert.ok(body.expense.every((c) => c.custom === false));
      assert.equal(body.expense[0].key, 'alimentacion');
    });
  },
);

test(
  'crear una categoría propia: aparece al final de su tipo y sirve para un movimiento y un presupuesto',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const created = await createCategory(api, token);
      assert.equal(created.status, 201);
      assert.match(created.body.key, /^c_/);
      assert.deepEqual(
        { ...created.body, key: undefined },
        { key: undefined, name: 'Mascotas', icon: 'paw-print', color: 'amber', custom: true },
      );

      const list = await api('/categories', { token });
      assert.equal(list.body.expense.at(-1).key, created.body.key);
      assert.equal(list.body.income.length, 4);

      const tx = await api('/transactions', {
        method: 'POST',
        token,
        body: {
          amount: 45000,
          description: 'Concentrado',
          type: 'gasto',
          date: '2026-10-20',
          category: created.body.key,
        },
      });
      assert.equal(tx.status, 201);
      assert.equal(tx.body.transaction.category, created.body.key);

      const budget = await api('/budgets', {
        method: 'POST',
        token,
        body: { category: created.body.key, month: '2026-10', amount: 100000 },
      });
      assert.equal(budget.status, 201);
    });
  },
);

test(
  'no se repite el nombre, ni siquiera con una de todos ni cambiando mayúsculas',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      assert.equal((await createCategory(api, token)).status, 201);
      const again = await createCategory(api, token, { name: '  mascotas ' });
      assert.equal(again.status, 409);
      assert.equal(again.body.error.code, 'CATEGORY_EXISTS');
      assert.equal((await createCategory(api, token, { name: 'SALUD' })).status, 409);
    });
  },
);

test('valida nombre, tipo, ícono y color', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const res = await createCategory(api, token, {
      name: '',
      type: 'otro',
      icon: 'dragon',
      color: 'red',
    });
    assert.equal(res.status, 422);
    assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), [
      'color',
      'icon',
      'name',
      'type',
    ]);
  });
});

test(`máximo ${MAX_OWN_CATEGORIES} categorías propias por usuario`, options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    for (let i = 0; i < MAX_OWN_CATEGORIES; i += 1) {
      assert.equal((await createCategory(api, token, { name: `Propia ${i}` })).status, 201);
    }
    const over = await createCategory(api, token, { name: 'Una más' });
    assert.equal(over.status, 409);
    assert.equal(over.body.error.code, 'CATEGORY_LIMIT');
  });
});

test('las categorías de un usuario no las ve ni las usa otro (RN-01)', options, async () => {
  await withApi(async (api) => {
    const owner = await newUserToken(api);
    const other = await newUserToken(api);
    const { body: category } = await createCategory(api, owner);

    const list = await api('/categories', { token: other });
    assert.ok(!list.body.expense.some((c) => c.key === category.key));
    // El otro puede crear una con el mismo nombre: son independientes.
    assert.equal((await createCategory(api, other)).status, 201);

    const tx = await api('/transactions', {
      method: 'POST',
      token: other,
      body: {
        amount: 1000,
        description: 'x',
        type: 'gasto',
        date: '2026-10-20',
        category: category.key,
      },
    });
    assert.equal(tx.status, 422);
    const budget = await api('/budgets', {
      method: 'POST',
      token: other,
      body: { category: category.key, month: '2026-10', amount: 1000 },
    });
    assert.equal(budget.status, 422);
    assert.equal(
      (
        await api(`/categories/${category.key}`, {
          method: 'PATCH',
          token: other,
          body: { name: 'Mía' },
        })
      ).status,
      404,
    );
    assert.equal(
      (await api(`/categories/${category.key}`, { method: 'DELETE', token: other })).status,
      404,
    );
  });
});

test(
  'renombrar y cambiar ícono; las de todos no se pueden editar ni eliminar',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const { body: category } = await createCategory(api, token);
      const renamed = await api(`/categories/${category.key}`, {
        method: 'PATCH',
        token,
        body: { name: 'Mi perro', icon: 'heart' },
      });
      assert.equal(renamed.status, 200);
      assert.deepEqual(
        [renamed.body.name, renamed.body.icon, renamed.body.color],
        ['Mi perro', 'heart', 'amber'],
      );

      assert.equal(
        (await api('/categories/salud', { method: 'PATCH', token, body: { name: 'X' } })).status,
        404,
      );
      assert.equal((await api('/categories/salud', { method: 'DELETE', token })).status, 404);
    });
  },
);

test(
  'eliminar una categoría propia: sus movimientos pasan a "Otros" y sus presupuestos se borran',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const { body: expense } = await createCategory(api, token);
      const { body: income } = await createCategory(api, token, {
        name: 'Ventas',
        type: 'ingreso',
      });
      const add = (category, type) =>
        api('/transactions', {
          method: 'POST',
          token,
          body: { amount: 20000, description: 'Movimiento', type, date: '2026-10-20', category },
        });
      const spent = await add(expense.key, 'gasto');
      await add(expense.key, 'gasto');
      const earned = await add(income.key, 'ingreso');
      await api('/budgets', {
        method: 'POST',
        token,
        body: { category: expense.key, month: '2026-10', amount: 100000 },
      });

      const removed = await api(`/categories/${expense.key}`, { method: 'DELETE', token });
      assert.equal(removed.status, 200);
      assert.deepEqual(removed.body, { moved: 2 });
      const moved = await api(`/transactions/${spent.body.transaction.id}`, { token });
      assert.equal(moved.body.category, 'otros');

      await api(`/categories/${income.key}`, { method: 'DELETE', token });
      const movedIncome = await api(`/transactions/${earned.body.transaction.id}`, { token });
      assert.equal(movedIncome.body.category, 'otros_ingresos');

      const budgets = await api('/budgets?month=2026-10', { token });
      assert.equal(budgets.body.length, 0);
      const list = await api('/categories', { token });
      assert.equal(list.body.expense.length + list.body.income.length, 15);
    });
  },
);
