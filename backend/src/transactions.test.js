import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/`.
// Si la tabla `transacciones` no existe se omiten con un aviso en vez de fallar.
const { rows } = await pool.query("SELECT to_regclass('public.transacciones') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const PASSWORD = 'clave-segura-1';
const TEST_DOMAIN = '@tx-test.fintrack.test';

// Borra los usuarios de prueba (sus transacciones caen por ON DELETE CASCADE).
after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre y entrega un cliente HTTP con dos usuarios ya registrados.
 * El proveedor de IA queda sin clave, así que las transacciones sin categoría salen `sin_clasificar`.
 * @param {(ctx: { api: (path: string, init?: { method?: string, body?: unknown, token?: string }) => Promise<{ status: number, body: object | null }>, alice: string, bob: string }) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
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
  const register = async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: { email: `u-${randomUUID()}${TEST_DOMAIN}`, password: PASSWORD },
    });
    return res.body.accessToken;
  };
  try {
    await fn({ api, alice: await register(), bob: await register() });
  } finally {
    server.close();
  }
}

const GASTO = { amount: 12500.5, description: 'Almuerzo', type: 'gasto', date: '2026-10-12' };

test('las rutas de transacciones exigen token (401)', options, async () => {
  await withApi(async ({ api }) => {
    for (const [path, method] of [
      ['/transactions', 'GET'],
      ['/transactions', 'POST'],
      [`/transactions/${randomUUID()}`, 'PUT'],
      [`/transactions/${randomUUID()}`, 'DELETE'],
    ]) {
      const res = await api(path, { method, body: method === 'GET' ? undefined : {} });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });
});

test(
  'POST con categoría manual crea la transacción (201) con el formato del contrato',
  options,
  async () => {
    await withApi(async ({ api, alice }) => {
      const res = await api('/transactions', {
        method: 'POST',
        token: alice,
        body: { ...GASTO, category: 'alimentacion' },
      });
      assert.equal(res.status, 201);
      assert.match(res.body.id, /^[0-9a-f-]{36}$/);
      assert.equal(res.body.amount, 12500.5);
      assert.equal(res.body.type, 'gasto');
      assert.equal(res.body.category, 'alimentacion');
      assert.equal(res.body.source, 'manual');
      assert.equal(res.body.date, '2026-10-12');
      assert.equal(res.body.deletedAt, null);
    });
  },
);

test(
  'POST sin categoría y sin IA disponible guarda "sin_clasificar" (REQ-011)',
  options,
  async () => {
    await withApi(async ({ api, alice }) => {
      const res = await api('/transactions', { method: 'POST', token: alice, body: GASTO });
      assert.equal(res.status, 201);
      assert.equal(res.body.category, null);
      assert.equal(res.body.source, 'sin_clasificar');
    });
  },
);

test('POST rechaza monto <= 0 y categoría de otro tipo con 422 y details', options, async () => {
  await withApi(async ({ api, alice }) => {
    const zero = await api('/transactions', {
      method: 'POST',
      token: alice,
      body: { ...GASTO, amount: 0 },
    });
    assert.equal(zero.status, 422);
    assert.equal(zero.body.error.code, 'VALIDATION_ERROR');
    assert.equal(zero.body.error.details[0].field, 'amount');

    const wrongType = await api('/transactions', {
      method: 'POST',
      token: alice,
      body: { ...GASTO, category: 'salario' },
    });
    assert.equal(wrongType.status, 422);
    assert.equal(wrongType.body.error.details[0].field, 'category');
  });
});

test('GET lista solo las transacciones propias, con filtros y paginación', options, async () => {
  await withApi(async ({ api, alice, bob }) => {
    const create = (token, body) => api('/transactions', { method: 'POST', token, body });
    await create(alice, { ...GASTO, category: 'alimentacion', date: '2026-10-10' });
    await create(alice, { ...GASTO, category: 'transporte', date: '2026-10-12' });
    await create(alice, {
      amount: 100,
      description: 'Nómina',
      type: 'ingreso',
      category: 'salario',
      date: '2026-10-11',
    });
    await create(bob, { ...GASTO, category: 'alimentacion' });

    const all = await api('/transactions', { token: alice });
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 3);
    assert.deepEqual(
      all.body.data.map((t) => t.date),
      ['2026-10-12', '2026-10-11', '2026-10-10'],
    );

    const gastos = await api('/transactions?type=gasto', { token: alice });
    assert.equal(gastos.body.total, 2);
    const cat = await api('/transactions?category=transporte', { token: alice });
    assert.equal(cat.body.total, 1);
    const range = await api('/transactions?from=2026-10-11&to=2026-10-11', { token: alice });
    assert.equal(range.body.total, 1);
    const page = await api('/transactions?pageSize=2&page=2', { token: alice });
    assert.equal(page.body.data.length, 1);
    assert.equal(page.body.total, 3);

    const bad = await api('/transactions?type=x', { token: alice });
    assert.equal(bad.status, 422);
  });
});

test(
  'PUT edita campos, y cambiar el tipo sin categoría deja "sin_clasificar"',
  options,
  async () => {
    await withApi(async ({ api, alice }) => {
      const created = await api('/transactions', {
        method: 'POST',
        token: alice,
        body: { ...GASTO, category: 'alimentacion' },
      });
      const id = created.body.id;

      const edited = await api(`/transactions/${id}`, {
        method: 'PUT',
        token: alice,
        body: { amount: 20000, description: 'Cena' },
      });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.amount, 20000);
      assert.equal(edited.body.description, 'Cena');
      assert.equal(edited.body.category, 'alimentacion');

      const recategorized = await api(`/transactions/${id}`, {
        method: 'PUT',
        token: alice,
        body: { category: 'transporte' },
      });
      assert.equal(recategorized.body.category, 'transporte');
      assert.equal(recategorized.body.source, 'manual');

      const typeChange = await api(`/transactions/${id}`, {
        method: 'PUT',
        token: alice,
        body: { type: 'ingreso' },
      });
      assert.equal(typeChange.body.type, 'ingreso');
      assert.equal(typeChange.body.category, null);
      assert.equal(typeChange.body.source, 'sin_clasificar');

      const empty = await api(`/transactions/${id}`, { method: 'PUT', token: alice, body: {} });
      assert.equal(empty.status, 422);
    });
  },
);

test(
  'un usuario no puede ver, editar ni borrar transacciones de otro (404, RN-01)',
  options,
  async () => {
    await withApi(async ({ api, alice, bob }) => {
      const created = await api('/transactions', { method: 'POST', token: alice, body: GASTO });
      const path = `/transactions/${created.body.id}`;
      assert.equal(
        (await api(path, { method: 'PUT', token: bob, body: { amount: 1 } })).status,
        404,
      );
      assert.equal((await api(path, { method: 'DELETE', token: bob })).status, 404);
      assert.equal((await api('/transactions', { token: bob })).body.total, 0);
      assert.equal(
        (await api('/transactions/no-es-uuid', { method: 'DELETE', token: bob })).status,
        404,
      );
    });
  },
);

test(
  'DELETE hace borrado lógico: desaparece del listado pero la fila queda marcada',
  options,
  async () => {
    await withApi(async ({ api, alice }) => {
      const created = await api('/transactions', { method: 'POST', token: alice, body: GASTO });
      const path = `/transactions/${created.body.id}`;

      assert.equal((await api(path, { method: 'DELETE', token: alice })).status, 204);
      assert.equal((await api('/transactions', { token: alice })).body.total, 0);
      assert.equal((await api(path, { method: 'DELETE', token: alice })).status, 404);

      const { rows: kept } = await pool.query(
        'SELECT deleted_at FROM transacciones WHERE id = $1',
        [created.body.id],
      );
      assert.ok(kept[0].deleted_at, 'la fila debe seguir existiendo con deleted_at');
    });
  },
);
