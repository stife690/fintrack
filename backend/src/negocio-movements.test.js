import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import {
  buildPanel,
  distribution,
  indicators,
  monthRange,
  percentChange,
  previousMonth,
  sumByKind,
  weeklyCashFlow,
} from './services/negocio-panel.logic.js';
import { monthTitle, reportFilename, resultLines } from './services/negocio-report.service.js';
import {
  parseExport,
  parseMonth,
  parseNewMovement,
  parseWithdrawal,
} from './validators/negocio-movements.validator.js';
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

/* ---------- FT-0018: retiros, reparto y exportación ---------- */

test('distribution reparte la utilidad según la participación y descuenta lo retirado', () => {
  const r = distribution({
    netProfit: 1_000_000,
    partners: [
      { userId: 'a', name: 'Rosa', share: 60 },
      { userId: 'b', name: 'Luis', share: 30 },
      { userId: 'c', name: 'Contador', share: null },
    ],
    withdrawals: [
      { userId: 'a', amount: 200_000 },
      { userId: 'b', amount: 400_000 },
    ],
  });
  assert.equal(r.available, 1_000_000);
  assert.equal(r.unassignedShare, 10);
  assert.deepEqual(
    r.items.map((i) => [i.userId, i.due, i.withdrawn, i.pending]),
    [
      ['a', 600_000, 200_000, 400_000],
      ['b', 300_000, 400_000, 0],
    ],
  );
  const loss = distribution({
    netProfit: -5000,
    partners: [{ userId: 'a', share: 100 }],
    withdrawals: [],
  });
  assert.equal(loss.available, 0);
  assert.equal(loss.items[0].due, 0);
});

test('los retiros no bajan la utilidad, pero salen de la caja', () => {
  const panel = buildPanel({
    month: '2026-11',
    movements: [
      { kind: 'sale', amount: 500, date: '2026-11-02' },
      { kind: 'withdrawal', amount: 200, date: '2026-11-03' },
    ],
    previousMovements: [],
  });
  assert.equal(panel.netProfit, 500);
  assert.equal(panel.withdrawal, 200);
  assert.equal(panel.retained, 300);
  assert.equal(panel.cashFlow[0].net, 300);
  assert.deepEqual(resultLines(panel).at(-1), ['Quedó en el negocio', 300, true]);
});

test('reportFilename deja un nombre de archivo limpio', () => {
  assert.equal(
    reportFilename('Arepas Doña Rosa!', '2026-11', 'xlsx'),
    'negocio-arepas-dona-rosa-2026-11.xlsx',
  );
  assert.equal(reportFilename('***', '2026-11', 'pdf'), 'negocio-negocio-2026-11.pdf');
  assert.equal(monthTitle('2026-11'), 'noviembre de 2026');
});

test('parseWithdrawal y parseExport', () => {
  assert.deepEqual(parseWithdrawal({ amount: 100000 }), {
    amount: 100000,
    date: null,
    note: null,
    localId: null,
  });
  assert.throws(
    () => parseWithdrawal({ amount: -1 }),
    (err) => err.statusCode === 422,
  );
  assert.deepEqual(parseExport({ format: 'pdf' }), { month: undefined, format: 'pdf' });
  assert.throws(
    () => parseExport({ format: 'csv' }),
    (err) => err.statusCode === 422,
  );
});

/**
 * Movimientos personales activos de un usuario.
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function personalCount(userId) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM transacciones WHERE usuario_id = $1 AND deleted_at IS NULL',
    [userId],
  );
  return rows[0].n;
}

test(
  'retiro: entra como ingreso personal, solo el socio lo deshace y el lector no retira',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, editor, reader, base } = await setup(api);
      const businessUrl = base.replace('/movements', '');
      await api(base, {
        method: 'POST',
        token: owner.token,
        body: { kind: 'sale', amount: 300000, description: 'Ventas' },
      });
      const body = { amount: 120000, note: 'Mi parte de la semana', localId: randomUUID() };
      const out = await api(`${businessUrl}/withdrawals`, {
        method: 'POST',
        token: editor.token,
        body,
      });
      assert.equal(out.status, 201);
      assert.equal(out.body.movement.kind, 'withdrawal');
      assert.equal(out.body.movement.category, 'retiros');
      assert.equal(out.body.transaction.type, 'ingreso');
      assert.equal(out.body.transaction.amount, 120000);
      assert.equal(out.body.transaction.category, 'otros_ingresos');
      const again = await api(`${businessUrl}/withdrawals`, {
        method: 'POST',
        token: editor.token,
        body,
      });
      assert.equal(again.status, 200, 'el mismo localId no duplica');
      assert.equal(await personalCount(editor.id), 1);

      const lectorTry = await api(`${businessUrl}/withdrawals`, {
        method: 'POST',
        token: reader.token,
        body: { amount: 1 },
      });
      assert.equal(lectorTry.status, 403);

      const month = await api(base, { token: owner.token });
      assert.equal(month.body.panel.netProfit, 300000, 'el retiro no es gasto');
      assert.equal(month.body.panel.retained, 180000);

      const id = out.body.movement.id;
      const byOwner = await api(`${base}/${id}`, { method: 'DELETE', token: owner.token });
      assert.equal(byOwner.status, 403, 'ni el dueño deshace el retiro de otro');
      const byEditor = await api(`${base}/${id}`, { method: 'DELETE', token: editor.token });
      assert.equal(byEditor.status, 204);
      assert.equal(await personalCount(editor.id), 0, 'deshacer el retiro borra el ingreso');
    });
  },
);

test(
  'reparto en el listado y exportación en Excel y PDF para todos los socios',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, editor, reader, outsider, base } = await setup(api);
      const businessId = base.split('/')[2];
      await pool.query(
        `UPDATE negocio_socios SET participacion = CASE WHEN usuario_id = $2 THEN 70 ELSE 30 END
       WHERE negocio_id = $1 AND usuario_id = ANY($3)`,
        [businessId, owner.id, [owner.id, editor.id]],
      );
      await api(base, {
        method: 'POST',
        token: owner.token,
        body: { kind: 'sale', amount: 100000, description: 'Ventas' },
      });
      const month = await api(base, { token: reader.token });
      assert.deepEqual(
        month.body.distribution.items.map((i) => [i.share, i.due]).sort((a, b) => b[0] - a[0]),
        [
          [70, 70000],
          [30, 30000],
        ],
      );

      const server = createApp().listen(0);
      try {
        const download = (token, format) =>
          fetch(
            `http://127.0.0.1:${server.address().port}/api/v1/businesses/${businessId}/export?format=${format}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
        const xlsx = await download(reader.token, 'xlsx');
        assert.equal(xlsx.status, 200, 'el lector también exporta');
        assert.match(xlsx.headers.get('content-type'), /spreadsheetml/);
        assert.match(
          xlsx.headers.get('content-disposition'),
          /negocio-arepas-dona-rosa-\d{4}-\d{2}\.xlsx/,
        );
        assert.ok((await xlsx.arrayBuffer()).byteLength > 1000);
        const pdf = await download(owner.token, 'pdf');
        assert.equal(pdf.status, 200);
        assert.equal(
          Buffer.from(await pdf.arrayBuffer())
            .subarray(0, 4)
            .toString(),
          '%PDF',
        );
        assert.equal((await download(outsider.token, 'pdf')).status, 404);
        assert.equal((await download(owner.token, 'csv')).status, 422);
      } finally {
        server.close();
      }
    });
  },
);
