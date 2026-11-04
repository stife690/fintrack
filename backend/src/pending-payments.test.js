import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import {
  createPendingPaymentsService,
  paymentKey,
  pendingPaymentPayload,
} from './services/pending-payments.service.js';
import {
  parseAmountText,
  parseConfirm,
  parseIncomingPayment,
  parsePaymentDate,
} from './validators/pending-payments.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Pagos por confirmar desde Atajos del iPhone (FT-0047).

/* ---------- Sin base de datos ---------- */

test('parseAmountText entiende cómo escribe el monto el iPhone', () => {
  assert.equal(parseAmountText(12500), 12500);
  assert.equal(parseAmountText('$12.500'), 12500);
  assert.equal(parseAmountText('COP 12.500,50'), 12500.5);
  assert.equal(parseAmountText('12,500.50'), 12500.5);
  assert.equal(parseAmountText('1.234.567'), 1234567);
  assert.equal(parseAmountText('12,5'), 12.5);
  assert.equal(parseAmountText('$0,99'), 0.99);
  assert.equal(parseAmountText('gratis'), null);
  assert.equal(parseAmountText(Number.NaN), null);
  assert.equal(parseAmountText(null), null);
});

test('parsePaymentDate acepta fecha sola o fecha con hora local', () => {
  assert.deepEqual(parsePaymentDate('2026-11-04'), { date: '2026-11-04', minute: null });
  assert.deepEqual(parsePaymentDate('2026-11-04T14:03:27-05:00'), {
    date: '2026-11-04',
    minute: '2026-11-04T14:03',
  });
  assert.equal(parsePaymentDate('2026-02-30'), null);
  assert.equal(parsePaymentDate('4 nov 2026'), null);
});

test('parseIncomingPayment valida lo que manda el Atajo', () => {
  assert.deepEqual(parseIncomingPayment({ merchant: ' Éxito ', amount: '$45.900', card: 'Visa' }), {
    merchant: 'Éxito',
    amount: 45900,
    date: null,
    minute: null,
    card: 'Visa',
    externalId: null,
  });
  assert.throws(
    () => parseIncomingPayment({ merchant: '', amount: 0, date: 'ayer' }),
    (err) =>
      err.statusCode === 422 &&
      ['merchant', 'amount', 'date'].every((f) => err.details.some((d) => d.field === f)),
  );
  assert.throws(
    () => parseIncomingPayment([]),
    (err) => err.statusCode === 400,
  );
});

test('parseConfirm deja todo opcional', () => {
  assert.deepEqual(parseConfirm(undefined), {});
  assert.deepEqual(parseConfirm({ category: 'mercado', description: ' Mercado ' }), {
    category: 'mercado',
    description: 'Mercado',
  });
  assert.throws(
    () => parseConfirm({ description: '' }),
    (err) => err.statusCode === 422,
  );
});

test('paymentKey: el mismo pago da la misma llave; el id del Atajo manda', () => {
  const base = {
    merchant: 'Éxito',
    amount: 45900,
    date: '2026-11-04',
    minute: null,
    externalId: null,
  };
  assert.equal(paymentKey(base), paymentKey({ ...base, merchant: 'ÉXITO' }));
  assert.notEqual(paymentKey(base), paymentKey({ ...base, minute: '2026-11-04T10:00' }));
  assert.notEqual(paymentKey(base), paymentKey({ ...base, amount: 45901 }));
  assert.equal(
    paymentKey({ ...base, externalId: 'abc' }),
    paymentKey({ ...base, amount: 1, externalId: 'abc' }),
  );
  assert.match(paymentKey(base), /^[0-9a-f]{64}$/);
});

test('pendingPaymentPayload lleva a Por confirmar', () => {
  assert.deepEqual(pendingPaymentPayload({ merchant: 'Éxito', amount: 45900 }), {
    title: 'Pago por confirmar',
    body: 'Éxito: $45.900. Confírmalo para anotarlo en tus movimientos.',
    url: '/app/por-confirmar',
  });
});

test('isEnabledFor: en producción solo la lista; fuera, vacío es para todos', () => {
  const svc = (nodeEnv, list) =>
    createPendingPaymentsService({
      repository: {},
      config: { nodeEnv, shortcutsAllowedEmails: list },
    });
  assert.equal(svc('development', []).isEnabledFor('a@b.co'), true);
  assert.equal(svc('production', []).isEnabledFor('a@b.co'), false);
  assert.equal(svc('production', ['a@b.co']).isEnabledFor('A@B.co'), true);
  assert.equal(svc('production', ['*']).isEnabledFor('x@y.co'), true);
});

/* ---------- Con la base real ---------- */

const { rows } = await pool.query("SELECT to_regclass('public.pagos_por_confirmar') AS tabla");
const options = {
  skip: !rows[0].tabla && 'Esquema no aplicado: falta la tabla pagos_por_confirmar',
};

const TEST_DOMAIN = '@atajos-test.fintrack.test';

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

test('las rutas exigen sesión y la entrada del Atajo exige su token', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/pending-payments')).status, 401);
    assert.equal((await api('/pending-payments/token', { method: 'POST' })).status, 401);
    const me = await newUser();
    // La sesión de la app no sirve como token del Atajo.
    const withSession = await api('/shortcuts/payments', {
      method: 'POST',
      token: me.token,
      body: { merchant: 'Éxito', amount: 1000 },
    });
    assert.equal(withSession.status, 401);
    const bogus = await api('/shortcuts/payments', {
      method: 'POST',
      token: 'ftk_no-existe',
      body: { merchant: 'Éxito', amount: 1000 },
    });
    assert.equal(bogus.status, 401);
  });
});

test('token: se crea una vez, se reemplaza y se revoca', options, async () => {
  await withApi(async (api) => {
    const me = await newUser();
    const before = await api('/pending-payments/token', { token: me.token });
    assert.deepEqual(before.body, { enabled: true, token: null });

    const first = await api('/pending-payments/token', { method: 'POST', token: me.token });
    assert.equal(first.status, 201);
    assert.match(first.body.token, /^ftk_[\w-]{43}$/);
    const stored = await pool.query('SELECT token_hash FROM atajo_tokens WHERE usuario_id = $1', [
      me.id,
    ]);
    assert.notEqual(stored.rows[0].token_hash, first.body.token, 'solo se guarda el hash');

    const second = await api('/pending-payments/token', { method: 'POST', token: me.token });
    const send = (token) =>
      api('/shortcuts/payments', { method: 'POST', token, body: { merchant: 'D1', amount: 3500 } });
    assert.equal((await send(first.body.token)).status, 401, 'el anterior deja de servir');
    assert.equal((await send(second.body.token)).status, 201);

    const status = await api('/pending-payments/token', { token: me.token });
    assert.ok(status.body.token.lastUsedAt);
    assert.equal(status.body.token.token, undefined, 'nunca se vuelve a mostrar');

    assert.equal(
      (await api('/pending-payments/token', { method: 'DELETE', token: me.token })).status,
      204,
    );
    assert.equal((await send(second.body.token)).status, 401);
  });
});

test(
  'llega un pago, no se duplica, se confirma como gasto y no se confirma dos veces',
  options,
  async () => {
    await withApi(async (api) => {
      const me = await newUser();
      const other = await newUser();
      const { body } = await api('/pending-payments/token', { method: 'POST', token: me.token });
      const payment = {
        merchant: 'Éxito Calle 80',
        amount: '$45.900',
        date: '2026-11-03T18:20:00-05:00',
        card: 'Visa Bancolombia',
      };
      const sent = await api('/shortcuts/payments', {
        method: 'POST',
        token: body.token,
        body: payment,
      });
      assert.equal(sent.status, 201);
      assert.equal(sent.body.duplicate, false);
      assert.equal(sent.body.payment.amount, 45900);
      assert.equal(sent.body.payment.date, '2026-11-03');
      assert.equal(sent.body.payment.status, 'pending');

      const again = await api('/shortcuts/payments', {
        method: 'POST',
        token: body.token,
        body: payment,
      });
      assert.equal(again.status, 200);
      assert.equal(again.body.duplicate, true);
      assert.equal(again.body.payment.id, sent.body.payment.id);

      // Nada entra a los movimientos sin confirmar.
      const tx = await pool.query(
        'SELECT count(*)::int AS n FROM transacciones WHERE usuario_id = $1',
        [me.id],
      );
      assert.equal(tx.rows[0].n, 0);

      const list = await api('/pending-payments', { token: me.token });
      assert.equal(list.body.items.length, 1);
      assert.equal(list.body.items[0].possibleDuplicate, false);
      assert.equal((await api('/pending-payments', { token: other.token })).body.items.length, 0);

      const id = sent.body.payment.id;
      const foreign = await api(`/pending-payments/${id}/confirm`, {
        method: 'POST',
        token: other.token,
      });
      assert.equal(foreign.status, 404);

      const ok = await api(`/pending-payments/${id}/confirm`, {
        method: 'POST',
        token: me.token,
        body: { category: 'alimentacion', description: 'Mercado del mes' },
      });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.payment.status, 'confirmed');
      assert.equal(ok.body.transaction.type, 'gasto');
      assert.equal(ok.body.transaction.amount, 45900);
      assert.equal(ok.body.transaction.date, '2026-11-03');
      assert.equal(ok.body.transaction.category, 'alimentacion');
      assert.equal(ok.body.transaction.source, 'manual');
      assert.equal(ok.body.payment.transactionId, ok.body.transaction.id);

      const twice = await api(`/pending-payments/${id}/confirm`, {
        method: 'POST',
        token: me.token,
      });
      assert.equal(twice.status, 409);
      assert.equal(twice.body.error.code, 'ALREADY_RESOLVED');
      assert.equal((await api('/pending-payments', { token: me.token })).body.items.length, 0);
    });
  },
);

test('descartar, categoría inválida y aviso de posible duplicado', options, async () => {
  await withApi(async (api) => {
    const me = await newUser();
    const { body } = await api('/pending-payments/token', { method: 'POST', token: me.token });
    await api('/transactions', {
      method: 'POST',
      token: me.token,
      body: {
        amount: 8000,
        description: 'Almuerzo',
        type: 'gasto',
        date: '2026-11-02',
        category: 'alimentacion',
      },
    });
    const send = (merchant, amount, date) =>
      api('/shortcuts/payments', {
        method: 'POST',
        token: body.token,
        body: { merchant, amount, date },
      });
    const dup = (await send('Corral', 8000, '2026-11-03')).body.payment;
    assert.equal(dup.possibleDuplicate, true, 'ya hay un gasto de 8.000 el día antes');
    const fresh = (await send('Rappi', 21000, '2026-11-03')).body.payment;
    assert.equal(fresh.possibleDuplicate, false);

    const badCategory = await api(`/pending-payments/${fresh.id}/confirm`, {
      method: 'POST',
      token: me.token,
      body: { category: 'salario' },
    });
    assert.equal(badCategory.status, 422);

    const discarded = await api(`/pending-payments/${dup.id}/discard`, {
      method: 'POST',
      token: me.token,
    });
    assert.equal(discarded.status, 200);
    assert.equal(discarded.body.status, 'discarded');
    assert.equal(
      (await api(`/pending-payments/${dup.id}/discard`, { method: 'POST', token: me.token }))
        .status,
      409,
    );
    assert.equal(
      (await api('/pending-payments/no-es-uuid/discard', { method: 'POST', token: me.token }))
        .status,
      404,
    );

    // Si el Atajo vuelve a mandar el descartado, no revive.
    const resent = await send('Corral', 8000, '2026-11-03');
    assert.equal(resent.body.duplicate, true);
    assert.equal(resent.body.payment.status, 'discarded');
    const left = (await api('/pending-payments', { token: me.token })).body.items;
    assert.deepEqual(
      left.map((p) => p.merchant),
      ['Rappi'],
    );
  });
});
