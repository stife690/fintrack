import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';

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
 * La clave de IA se quita mientras dura la prueba (aunque `.env` traiga una), así que las
 * transacciones sin categoría salen `sin_clasificar` sin llamar a un proveedor real.
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
  const previousKey = env.aiApiKey;
  env.aiApiKey = undefined;
  try {
    await fn({ api, alice: await register(), bob: await register() });
  } finally {
    env.aiApiKey = previousKey;
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
      assert.equal(res.body.alert, null);
      assert.match(res.body.transaction.id, /^[0-9a-f-]{36}$/);
      assert.equal(res.body.transaction.amount, 12500.5);
      assert.equal(res.body.transaction.type, 'gasto');
      assert.equal(res.body.transaction.category, 'alimentacion');
      assert.equal(res.body.transaction.source, 'manual');
      assert.equal(res.body.transaction.date, '2026-10-12');
      assert.equal(res.body.transaction.deletedAt, null);
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
      assert.equal(res.body.transaction.category, null);
      assert.equal(res.body.transaction.source, 'sin_clasificar');
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

    const search = await api('/transactions?q=n%C3%B3mi', { token: alice });
    assert.equal(search.body.total, 1);
    assert.equal(search.body.data[0].description, 'Nómina');
    const noMatch = await api('/transactions?q=%25', { token: alice });
    assert.equal(noMatch.body.total, 0, 'el % se busca como texto literal, no como comodín');

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
      const id = created.body.transaction.id;

      const edited = await api(`/transactions/${id}`, {
        method: 'PUT',
        token: alice,
        body: { amount: 20000, description: 'Cena' },
      });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.transaction.amount, 20000);
      assert.equal(edited.body.transaction.description, 'Cena');
      assert.equal(edited.body.transaction.category, 'alimentacion');

      const recategorized = await api(`/transactions/${id}`, {
        method: 'PUT',
        token: alice,
        body: { category: 'transporte' },
      });
      assert.equal(recategorized.body.transaction.category, 'transporte');
      assert.equal(recategorized.body.transaction.source, 'manual');

      const typeChange = await api(`/transactions/${id}`, {
        method: 'PUT',
        token: alice,
        body: { type: 'ingreso' },
      });
      assert.equal(typeChange.body.transaction.type, 'ingreso');
      assert.equal(typeChange.body.transaction.category, null);
      assert.equal(typeChange.body.transaction.source, 'sin_clasificar');

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
      const path = `/transactions/${created.body.transaction.id}`;
      assert.equal(
        (await api(path, { method: 'PUT', token: bob, body: { amount: 1 } })).status,
        404,
      );
      assert.equal((await api(path, { method: 'DELETE', token: bob })).status, 404);
      assert.equal((await api(path, { token: bob })).status, 404);
      assert.equal((await api('/transactions', { token: bob })).body.total, 0);
      assert.equal(
        (await api('/transactions/no-es-uuid', { method: 'DELETE', token: bob })).status,
        404,
      );
    });
  },
);

test('GET /transactions/:id devuelve la transacción propia y 404 si no existe', options, async () => {
  await withApi(async ({ api, alice }) => {
    const created = await api('/transactions', {
      method: 'POST',
      token: alice,
      body: { ...GASTO, category: 'alimentacion' },
    });
    const one = await api(`/transactions/${created.body.transaction.id}`, { token: alice });
    assert.equal(one.status, 200);
    assert.deepEqual(one.body, created.body.transaction);
    assert.equal((await api('/transactions/no-es-uuid', { token: alice })).status, 404);
  });
});

test(
  'DELETE hace borrado lógico: desaparece del listado pero la fila queda marcada',
  options,
  async () => {
    await withApi(async ({ api, alice }) => {
      const created = await api('/transactions', { method: 'POST', token: alice, body: GASTO });
      const path = `/transactions/${created.body.transaction.id}`;

      assert.equal((await api(path, { method: 'DELETE', token: alice })).status, 204);
      assert.equal((await api('/transactions', { token: alice })).body.total, 0);
      assert.equal((await api(path, { method: 'DELETE', token: alice })).status, 404);

      const { rows: kept } = await pool.query(
        'SELECT deleted_at FROM transacciones WHERE id = $1',
        [created.body.transaction.id],
      );
      assert.ok(kept[0].deleted_at, 'la fila debe seguir existiendo con deleted_at');
    });
  },
);

test(
  'GET /summary agrega solo las transacciones propias y no borradas del periodo',
  options,
  async () => {
    await withApi(async ({ api, alice, bob }) => {
      const create = (token, body) => api('/transactions', { method: 'POST', token, body });
      // Semana del lunes 2026-10-19 al domingo 2026-10-25.
      await create(alice, {
        ...GASTO,
        amount: 30000,
        category: 'alimentacion',
        date: '2026-10-19',
      });
      await create(alice, { ...GASTO, amount: 10000, category: 'transporte', date: '2026-10-21' });
      await create(alice, {
        amount: 100000,
        description: 'Pago',
        type: 'ingreso',
        category: 'salario',
        date: '2026-10-21',
      });
      // Fuera de la semana, borrada o de otro usuario: no deben contar.
      await create(alice, { ...GASTO, amount: 999, category: 'alimentacion', date: '2026-10-18' });
      const deleted = await create(alice, { ...GASTO, amount: 777, date: '2026-10-20' });
      await api(`/transactions/${deleted.body.transaction.id}`, { method: 'DELETE', token: alice });
      await create(bob, { ...GASTO, amount: 555, date: '2026-10-20' });

      const res = await api('/transactions/summary?period=week&date=2026-10-22', { token: alice });
      assert.equal(res.status, 200);
      assert.equal(res.body.from, '2026-10-19');
      assert.equal(res.body.to, '2026-10-25');
      assert.deepEqual(res.body.income, {
        total: 100000,
        byCategory: [{ category: 'salario', total: 100000, percentage: 100 }],
      });
      assert.deepEqual(res.body.expense, {
        total: 40000,
        byCategory: [
          { category: 'alimentacion', total: 30000, percentage: 75 },
          { category: 'transporte', total: 10000, percentage: 25 },
        ],
      });
      assert.deepEqual(res.body.timeSeries, [
        { date: '2026-10-19', income: 0, expense: 30000 },
        { date: '2026-10-21', income: 100000, expense: 10000 },
      ]);

      const year = await api('/transactions/summary?period=year&date=2026-01-01', { token: alice });
      assert.deepEqual(year.body.timeSeries, [
        { date: '2026-10-01', income: 100000, expense: 40999 },
      ]);
    });
  },
);

test('GET /summary sin transacciones responde ceros y listas vacías', options, async () => {
  await withApi(async ({ api, bob }) => {
    const res = await api('/transactions/summary?period=month&date=2026-10-20', { token: bob });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.income, { total: 0, byCategory: [] });
    assert.deepEqual(res.body.expense, { total: 0, byCategory: [] });
    assert.deepEqual(res.body.timeSeries, []);
  });
});

test(
  'GET /summary incluye el primer y el último día del periodo, y nada fuera',
  options,
  async () => {
    await withApi(async ({ api, alice }) => {
      const gasto = (date, amount) =>
        api('/transactions', {
          method: 'POST',
          token: alice,
          body: { ...GASTO, amount, category: 'otros', date },
        });
      // Semana del lunes 2026-10-19 al domingo 2026-10-25, y bordes de mes y de año.
      const days = [
        ['2025-12-31', 1],
        ['2026-01-01', 2],
        ['2026-09-30', 4],
        ['2026-10-01', 8],
        ['2026-10-18', 16],
        ['2026-10-19', 32],
        ['2026-10-25', 64],
        ['2026-10-26', 128],
        ['2026-10-31', 256],
        ['2026-11-01', 512],
        ['2026-12-31', 1024],
        ['2027-01-01', 2048],
      ];
      const created = await Promise.all(days.map(([date, amount]) => gasto(date, amount)));
      assert.deepEqual(
        created.map((r) => r.status),
        days.map(() => 201),
        'todas las transacciones de prueba deben crearse',
      );
      const total = async (query) =>
        (await api(`/transactions/summary?${query}`, { token: alice })).body.expense.total;

      // Cada monto es una potencia de 2: el total dice exactamente qué días entraron.
      assert.equal(await total('period=week&date=2026-10-22'), 32 + 64);
      assert.equal(await total('period=month&date=2026-10-15'), 8 + 16 + 32 + 64 + 128 + 256);
      assert.equal(
        await total('period=year&date=2026-06-01'),
        2 + 4 + 8 + 16 + 32 + 64 + 128 + 256 + 512 + 1024,
      );
    });
  },
);

test('GET /summary agrupa los gastos sin clasificar con category null', options, async () => {
  await withApi(async ({ api, alice }) => {
    // Sin clave de IA, un gasto sin categoría queda `sin_clasificar`.
    const created = await api('/transactions', {
      method: 'POST',
      token: alice,
      body: { ...GASTO, amount: 3000, description: 'Algo raro' },
    });
    assert.equal(created.body.transaction.source, 'sin_clasificar');
    await api('/transactions', {
      method: 'POST',
      token: alice,
      body: { ...GASTO, amount: 1000, category: 'transporte' },
    });

    const res = await api('/transactions/summary?period=month&date=2026-10-12', { token: alice });
    assert.deepEqual(res.body.expense, {
      total: 4000,
      byCategory: [
        { category: null, total: 3000, percentage: 75 },
        { category: 'transporte', total: 1000, percentage: 25 },
      ],
    });
  });
});

test('GET /summary suma centavos sin errores de redondeo', options, async () => {
  await withApi(async ({ api, alice }) => {
    // En categorías distintas: la suma final la hace JS (0.1 + 0.2 daría 0.30000000000000004).
    for (const [amount, category] of [
      [0.1, 'alimentacion'],
      [0.2, 'transporte'],
    ]) {
      await api('/transactions', {
        method: 'POST',
        token: alice,
        body: { ...GASTO, amount, category },
      });
    }
    const res = await api('/transactions/summary?period=month&date=2026-10-12', { token: alice });
    assert.equal(res.body.expense.total, 0.3);
    assert.deepEqual(res.body.timeSeries, [{ date: '2026-10-12', income: 0, expense: 0.3 }]);
  });
});

test('GET /summary refleja las ediciones de fecha y de tipo', options, async () => {
  await withApi(async ({ api, alice }) => {
    const created = await api('/transactions', {
      method: 'POST',
      token: alice,
      body: { ...GASTO, amount: 5000, category: 'otros', date: '2026-10-12' },
    });
    const id = created.body.transaction.id;
    const october = () =>
      api('/transactions/summary?period=month&date=2026-10-01', { token: alice }).then(
        (r) => r.body,
      );

    // Pasa a ser un ingreso del mismo mes: sale de gastos y entra en ingresos.
    await api(`/transactions/${id}`, {
      method: 'PUT',
      token: alice,
      body: { type: 'ingreso', category: 'otros_ingresos' },
    });
    let summary = await october();
    assert.equal(summary.expense.total, 0);
    assert.equal(summary.income.total, 5000);

    // Se mueve a noviembre: octubre queda vacío.
    await api(`/transactions/${id}`, { method: 'PUT', token: alice, body: { date: '2026-11-03' } });
    summary = await october();
    assert.equal(summary.income.total, 0);
    assert.deepEqual(summary.timeSeries, []);
    const november = await api('/transactions/summary?period=month&date=2026-11-01', {
      token: alice,
    });
    assert.equal(november.body.income.total, 5000, 'debe aparecer en el mes nuevo');
  });
});

test('GET /summary exige token (401) y valida period/date (422)', options, async () => {
  await withApi(async ({ api, alice }) => {
    assert.equal((await api('/transactions/summary?period=week')).status, 401);
    const bad = await api('/transactions/summary?period=day&date=2026-13-01', { token: alice });
    assert.equal(bad.status, 422);
    assert.deepEqual(bad.body.error.details.map((d) => d.field).sort(), ['date', 'period']);
  });
});
