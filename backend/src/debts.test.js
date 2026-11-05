import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { listDebtsDueTomorrow } from './repositories/debts.repository.js';
import { pendingTotals, settlementMovement } from './services/debts.service.js';
import { parseNewDebt, parseSettle } from './validators/debts.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Cuentas por cobrar y por pagar (FT-0046) con la base real.
const { rows } = await pool.query("SELECT to_regclass('public.cuentas_personales') AS tabla");
const options = {
  skip: !rows[0].tabla && 'Esquema no aplicado: falta la tabla cuentas_personales',
};

const TEST_DOMAIN = '@cuentas-test.fintrack.test';
// En la zona del usuario de prueba (Bogotá): en UTC ya es mañana desde las 7 p. m.
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

after(async () => {
  if (!options.skip) {
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

test('las rutas de cuentas exigen token (401)', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/debts')).status, 401);
    assert.equal((await api('/debts', { method: 'POST', body: {} })).status, 401);
  });
});

test(
  'crear, listar con totales pendientes, editar y borrar; nadie ve las de otro',
  options,
  async () => {
    await withApi(async (api) => {
      const me = await newUser();
      const other = await newUser();
      const lent = await api('/debts', {
        method: 'POST',
        token: me.token,
        body: { kind: 'receivable', person: ' Juan ', amount: 50000, dueDate: '2026-12-01' },
      });
      assert.equal(lent.status, 201);
      assert.equal(lent.body.person, 'Juan');
      assert.equal(lent.body.dueDate, '2026-12-01');
      assert.equal(lent.body.settledAt, null);
      await api('/debts', {
        method: 'POST',
        token: me.token,
        body: { kind: 'payable', person: 'Tía Rosa', amount: 20000, note: 'Almuerzo' },
      });

      const listed = await api('/debts', { token: me.token });
      assert.equal(listed.status, 200);
      assert.equal(listed.body.items.length, 2);
      assert.deepEqual(listed.body.totals, { receivable: 50000, payable: 20000 });

      const edited = await api(`/debts/${lent.body.id}`, {
        method: 'PUT',
        token: me.token,
        body: { amount: 60000, dueDate: null },
      });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.amount, 60000);
      assert.equal(edited.body.dueDate, null);

      // RN-01: otro usuario no la ve ni la toca.
      assert.equal((await api('/debts', { token: other.token })).body.items.length, 0);
      assert.equal(
        (await api(`/debts/${lent.body.id}`, { method: 'DELETE', token: other.token })).status,
        404,
      );
      assert.equal(
        (await api('/debts/no-es-uuid/settle', { method: 'POST', token: me.token })).status,
        404,
      );

      assert.equal(
        (await api(`/debts/${lent.body.id}`, { method: 'DELETE', token: me.token })).status,
        204,
      );
      assert.equal((await api('/debts', { token: me.token })).body.items.length, 1);
    });
  },
);

test(
  'saldar crea el ingreso o el gasto una sola vez; sin movimiento si no se pide',
  options,
  async () => {
    await withApi(async (api) => {
      const me = await newUser();
      const create = (body) => api('/debts', { method: 'POST', token: me.token, body });
      const owed = await create({ kind: 'receivable', person: 'Juan', amount: 50000 });
      const mine = await create({ kind: 'payable', person: 'Ana', amount: 12500 });
      const gift = await create({ kind: 'payable', person: 'Leo', amount: 8000 });

      const paid = await api(`/debts/${owed.body.id}/settle`, { method: 'POST', token: me.token });
      assert.equal(paid.status, 200);
      assert.ok(paid.body.debt.settledAt);
      assert.equal(paid.body.debt.transactionId, paid.body.transaction.id);
      assert.equal(paid.body.transaction.type, 'ingreso');
      assert.equal(paid.body.transaction.amount, 50000);
      assert.equal(paid.body.transaction.description, 'Juan me pagó');

      // Dos toques seguidos no crean dos movimientos.
      const again = await api(`/debts/${owed.body.id}/settle`, { method: 'POST', token: me.token });
      assert.equal(again.status, 409);
      assert.equal(again.body.error.code, 'ALREADY_SETTLED');
      // Una saldada ya no se edita.
      assert.equal(
        (
          await api(`/debts/${owed.body.id}`, {
            method: 'PUT',
            token: me.token,
            body: { amount: 1 },
          })
        ).status,
        409,
      );

      const out = await api(`/debts/${mine.body.id}/settle`, {
        method: 'POST',
        token: me.token,
        body: { date: TODAY },
      });
      assert.equal(out.body.transaction.type, 'gasto');
      assert.equal(out.body.transaction.description, 'Le pagué a Ana');

      const none = await api(`/debts/${gift.body.id}/settle`, {
        method: 'POST',
        token: me.token,
        body: { createTransaction: false },
      });
      assert.equal(none.body.transaction, null);
      assert.equal(none.body.debt.transactionId, null);

      const future = await create({ kind: 'payable', person: 'Eva', amount: 1000 });
      const tooLate = await api(`/debts/${future.body.id}/settle`, {
        method: 'POST',
        token: me.token,
        body: { date: '2999-01-01' },
      });
      assert.equal(tooLate.status, 422);

      const tx = await api('/transactions?limit=50', { token: me.token });
      const descriptions = (tx.body.items ?? tx.body.data ?? tx.body).map((t) => t.description);
      assert.deepEqual(descriptions.sort(), ['Juan me pagó', 'Le pagué a Ana']);

      const listed = await api('/debts', { token: me.token });
      assert.deepEqual(listed.body.totals, { receivable: 0, payable: 1000 });
      assert.equal(listed.body.items[0].person, 'Eva', 'las pendientes van primero');
    });
  },
);

test(
  'el aviso busca las pendientes que vencen mañana en la hora del usuario',
  options,
  async () => {
    const me = await newUser();
    const { rows: local } = await pool.query(
      `SELECT to_char((now() AT TIME ZONE timezone)::date + 1, 'YYYY-MM-DD') AS tomorrow
     FROM usuarios WHERE id = $1`,
      [me.id],
    );
    const insert = (person, date, settled = false) =>
      pool.query(
        `INSERT INTO cuentas_personales (usuario_id, tipo, persona, monto, fecha_limite, saldada_at)
       VALUES ($1, 'por_cobrar', $2, 1000, $3, $4)`,
        [me.id, person, date, settled ? new Date() : null],
      );
    await insert('Mañana', local[0].tomorrow);
    await insert('Saldada', local[0].tomorrow, true);
    await insert('Hoy', TODAY === local[0].tomorrow ? '2000-01-01' : TODAY);
    const due = (await listDebtsDueTomorrow()).filter((d) => d.userId === me.id);
    assert.deepEqual(
      due.map((d) => d.person),
      ['Mañana'],
    );
    assert.match(due[0].time, /^\d{2}:\d{2}$/);
  },
);

test('validaciones y cálculos sin base', () => {
  assert.throws(
    () => parseNewDebt({ kind: 'otro', person: '', amount: -1 }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.deepEqual(
        err.details.map((d) => d.field),
        ['kind', 'person', 'amount'],
      );
      return true;
    },
  );
  assert.deepEqual(parseSettle(undefined), { createTransaction: true });
  assert.deepEqual(settlementMovement({ kind: 'receivable', person: 'Juan' }), {
    type: 'ingreso',
    category: 'otros_ingresos',
    description: 'Juan me pagó',
  });
  assert.deepEqual(
    pendingTotals([
      { kind: 'receivable', amount: 0.1, settledAt: null },
      { kind: 'receivable', amount: 0.2, settledAt: null },
      { kind: 'payable', amount: 5, settledAt: new Date() },
    ]),
    { receivable: 0.3, payable: 0 },
  );
});
