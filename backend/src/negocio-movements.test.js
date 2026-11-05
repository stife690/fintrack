import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import {
  buildPanel,
  indicators,
  monthRange,
  percentChange,
  previousMonth,
  sumByKind,
  weeklyCashFlow,
} from './services/negocio-panel.logic.js';
import { parseMonth, parseNewMovement } from './validators/negocio-movements.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Movimientos y panel de los negocios (FT-0017).

/* ---------- Cálculos del panel (funciones puras) ---------- */

test('monthRange y previousMonth', () => {
  assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(monthRange('2026-11'), { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(previousMonth('2026-11'), '2026-10');
  assert.equal(previousMonth('2026-01'), '2025-12');
});

test('indicators: utilidades, márgenes y punto de equilibrio', () => {
  const t = sumByKind([
    { kind: 'sale', amount: 1_000_000 },
    { kind: 'sale', amount: 500_000 },
    { kind: 'otherIncome', amount: 50_000 },
    { kind: 'cost', amount: 600_000 },
    { kind: 'variable', amount: 150_000 },
    { kind: 'fixed', amount: 450_000 },
  ]);
  const r = indicators(t);
  assert.equal(r.sale, 1_500_000);
  assert.equal(r.income, 1_550_000);
  assert.equal(r.expenses, 1_200_000);
  assert.equal(r.grossProfit, 900_000);
  assert.equal(r.netProfit, 350_000);
  assert.equal(r.netMargin, 23.3);
  // Cada peso vendido deja (1.500.000 − 600.000 − 150.000) / 1.500.000 = 50 %.
  assert.equal(r.contributionMargin, 50);
  // 450.000 de fijos / 0,5 = 900.000 en ventas para no perder.
  assert.equal(r.breakEven, 900_000);
  assert.equal(r.breakEvenReached, true);
});

test('indicators: sin ventas o sin fijos no inventa márgenes', () => {
  const empty = indicators(sumByKind([]));
  assert.equal(empty.netMargin, null);
  assert.equal(empty.contributionMargin, null);
  assert.equal(empty.breakEven, null);
  assert.equal(empty.breakEvenReached, null);

  const losing = indicators(
    sumByKind([
      { kind: 'sale', amount: 100 },
      { kind: 'cost', amount: 120 },
      { kind: 'fixed', amount: 50 },
    ]),
  );
  assert.equal(losing.contributionMargin, -20);
  assert.equal(losing.breakEven, null, 'si vender deja pérdida no hay punto de equilibrio');
  assert.equal(losing.netProfit, -70);
});

test('el punto de equilibrio se redondea hacia arriba a pesos enteros', () => {
  const r = indicators(
    sumByKind([
      { kind: 'sale', amount: 630_000 },
      { kind: 'cost', amount: 220_000 },
      { kind: 'variable', amount: 30_000 },
      { kind: 'fixed', amount: 300_000 },
    ]),
  );
  // 300.000 / (380.000 / 630.000) = 497.368,42… → 497.369.
  assert.equal(r.breakEven, 497_369);
});

test('percentChange no divide por cero', () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(-50, 100), -150);
  assert.equal(percentChange(10, 0), null);
  assert.equal(percentChange(50, -100), 150);
});

test('weeklyCashFlow reparte el mes en semanas de 7 días', () => {
  const weeks = weeklyCashFlow(
    [
      { kind: 'sale', amount: 100, date: '2026-11-01' },
      { kind: 'fixed', amount: 30, date: '2026-11-07' },
      { kind: 'cost', amount: 20, date: '2026-11-08' },
      { kind: 'otherIncome', amount: 5, date: '2026-11-30' },
    ],
    '2026-11',
  );
  assert.deepEqual(
    weeks.map((w) => [w.label, w.in, w.out, w.net]),
    [
      ['1–7', 100, 30, 70],
      ['8–14', 0, 20, -20],
      ['15–21', 0, 0, 0],
      ['22–28', 0, 0, 0],
      ['29–30', 5, 0, 5],
    ],
  );
});

test('buildPanel compara con el mes anterior', () => {
  const panel = buildPanel({
    month: '2026-11',
    movements: [{ kind: 'sale', amount: 300, date: '2026-11-02' }],
    previousMovements: [{ kind: 'sale', amount: 200, date: '2026-10-02' }],
  });
  assert.equal(panel.previous.month, '2026-10');
  assert.equal(panel.previous.saleChange, 50);
  assert.equal(panel.previous.netProfitChange, 50);
  assert.equal(panel.cashFlow.length, 5);
});

test('parseNewMovement y parseMonth', () => {
  assert.deepEqual(parseNewMovement({ kind: 'sale', amount: 12000.004, description: ' Arepas ' }), {
    kind: 'sale',
    category: 'ventas',
    amount: 12000,
    description: 'Arepas',
    date: null,
    localId: null,
  });
  assert.equal(
    parseNewMovement({ kind: 'fixed', amount: 1, description: 'x' }).category,
    'arriendo',
  );
  assert.throws(
    () => parseNewMovement({ kind: 'gasto', amount: 0, description: '', category: 'comida' }),
    (err) =>
      err.statusCode === 422 &&
      ['kind', 'amount', 'description', 'category'].every((f) =>
        err.details.some((d) => d.field === f),
      ),
  );
  assert.equal(parseMonth(undefined), undefined);
  assert.equal(parseMonth('2026-11'), '2026-11');
  assert.throws(
    () => parseMonth('2026-13'),
    (err) => err.statusCode === 422,
  );
});

/* ---------- Con la base real ---------- */

const { rows } = await pool.query("SELECT to_regclass('public.negocio_movimientos') AS tabla");
const options = {
  skip: !rows[0].tabla && 'Esquema no aplicado: falta la tabla negocio_movimientos',
};

const TEST_DOMAIN = '@negocio-mov-test.fintrack.test';

after(async () => {
  if (!options.skip) {
    await pool.query(
      `DELETE FROM negocios WHERE id IN (
         SELECT s.negocio_id FROM negocio_socios s JOIN usuarios u ON u.id = s.usuario_id
         WHERE u.email LIKE $1)`,
      [`%${TEST_DOMAIN}`],
    );
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app, ejecuta `fn` con un cliente JSON y cierra el servidor.
 * @param {(api: (url: string, init?: { method?: string, token?: string, body?: unknown }) => Promise<{ status: number, body: object|null }>) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (url, { method = 'GET', token, body } = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  }
}

/** @returns {Promise<{ token: string, id: string }>} */
async function newUser() {
  const session = await createVerifiedSession({
    email: `u-${randomUUID()}${TEST_DOMAIN}`,
    password: 'clave-segura-1',
  });
  return { token: session.accessToken, id: session.user.id };
}

/**
 * Negocio con dueño, editor (entra con el código) y lector (se agrega directo en la base).
 * @param {(url: string, init?: object) => Promise<{ status: number, body: object|null }>} api
 * @returns {Promise<{ owner: object, editor: object, reader: object, outsider: object, base: string }>}
 */
async function setup(api) {
  const [owner, editor, reader, outsider] = await Promise.all([
    newUser(),
    newUser(),
    newUser(),
    newUser(),
  ]);
  const created = await api('/businesses', {
    method: 'POST',
    token: owner.token,
    body: { name: 'Arepas Doña Rosa' },
  });
  await api('/businesses/join', {
    method: 'POST',
    token: editor.token,
    body: { code: created.body.code },
  });
  await pool.query(
    "INSERT INTO negocio_socios (negocio_id, usuario_id, rol) VALUES ($1, $2, 'lector')",
    [created.body.id, reader.id],
  );
  return { owner, editor, reader, outsider, base: `/businesses/${created.body.id}/movements` };
}

test('registrar, ver el panel y respetar los roles', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, reader, outsider, base } = await setup(api);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const month = today.slice(0, 7);
    const add = (token, body) => api(base, { method: 'POST', token, body });

    const sale = await add(editor.token, { kind: 'sale', amount: 200000, description: 'Arepas' });
    assert.equal(sale.status, 201);
    assert.equal(sale.body.kind, 'sale');
    assert.equal(sale.body.category, 'ventas');
    assert.equal(sale.body.registeredBy.id, editor.id);
    assert.equal(sale.body.date, today);
    await add(owner.token, { kind: 'cost', amount: 80000, description: 'Harina y queso' });
    await add(owner.token, { kind: 'fixed', amount: 60000, description: 'Arriendo del local' });

    const lectorTry = await add(reader.token, { kind: 'sale', amount: 1, description: 'x' });
    assert.equal(lectorTry.status, 403);
    assert.equal(
      (await add(outsider.token, { kind: 'sale', amount: 1, description: 'x' })).status,
      404,
    );
    const future = await add(owner.token, {
      kind: 'sale',
      amount: 1,
      description: 'x',
      date: '2999-01-01',
    });
    assert.equal(future.status, 422);

    const seen = await api(`${base}?month=${month}`, { token: reader.token });
    assert.equal(seen.status, 200);
    assert.equal(seen.body.canRecord, false, 'el lector ve pero no registra');
    assert.equal(seen.body.movements.length, 3);
    assert.equal(seen.body.panel.sale, 200000);
    assert.equal(seen.body.panel.grossProfit, 120000);
    assert.equal(seen.body.panel.netProfit, 60000);
    assert.equal(seen.body.panel.breakEven, 100000);
    assert.equal((await api(base, { token: editor.token })).body.canRecord, true);
    assert.equal((await api(base, { token: outsider.token })).status, 404);
    assert.equal((await api(`${base}?month=2026-13`, { token: owner.token })).status, 422);

    // Los movimientos del negocio no se mezclan con las finanzas personales.
    const personal = await pool.query(
      'SELECT count(*)::int AS n FROM transacciones WHERE usuario_id = ANY($1)',
      [[owner.id, editor.id]],
    );
    assert.equal(personal.rows[0].n, 0);
  });
});

test('el mismo localId se registra una sola vez', options, async () => {
  await withApi(async (api) => {
    const { owner, base } = await setup(api);
    const body = { kind: 'sale', amount: 5000, description: 'Tinto', localId: randomUUID() };
    const first = await api(base, { method: 'POST', token: owner.token, body });
    const again = await api(base, { method: 'POST', token: owner.token, body });
    assert.equal(first.status, 201);
    assert.equal(again.status, 200);
    assert.equal(again.body.id, first.body.id);
    assert.equal((await api(base, { token: owner.token })).body.movements.length, 1);
  });
});

test('borrar: quien lo registró o un dueño; el lector no', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, reader, base } = await setup(api);
    const add = (token) =>
      api(base, {
        method: 'POST',
        token,
        body: { kind: 'variable', amount: 3000, description: 'Bolsas' },
      });
    const byOwner = (await add(owner.token)).body;
    const byEditor = (await add(editor.token)).body;
    const del = (token, id) => api(`${base}/${id}`, { method: 'DELETE', token });

    assert.equal((await del(editor.token, byOwner.id)).status, 403, 'el editor no borra lo ajeno');
    assert.equal((await del(reader.token, byEditor.id)).status, 403);
    assert.equal((await del(editor.token, byEditor.id)).status, 204);
    assert.equal((await del(owner.token, byOwner.id)).status, 204);
    assert.equal((await del(owner.token, byOwner.id)).status, 404);
    assert.equal((await del(owner.token, 'no-es-uuid')).status, 404);
  });
});
