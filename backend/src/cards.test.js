import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';
import { list as listCards } from './services/cards.service.js';
import { todayIso } from './services/insights.service.js';
import { createReminderScheduler } from './services/reminder-scheduler.service.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/`.
// Si la tabla `tarjetas` no existe se omiten con un aviso en vez de fallar.
const { rows } = await pool.query("SELECT to_regclass('public.tarjetas') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@cards-test.fintrack.test';

// Borra los usuarios de prueba; sus tarjetas y transacciones caen por ON DELETE CASCADE.
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
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(api: Api) => Promise<void>} fn
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
  try {
    await fn(api);
  } finally {
    server.close();
  }
}

/**
 * Registra un usuario nuevo y devuelve su access token.
 * @returns {Promise<string>}
 */
async function newUserToken() {
  return (await newUser()).token;
}

/**
 * Registra un usuario nuevo y devuelve su token y su id.
 * @returns {Promise<{ token: string, id: string }>}
 */
async function newUser() {
  const body = await createVerifiedSession({
    email: `u-${randomUUID()}${TEST_DOMAIN}`,
    password: 'clave-segura-1',
  });
  return { token: body.accessToken, id: body.user.id };
}

/** Hoy y el día de mañana del usuario de prueba (zona por defecto, Bogotá). */
const TODAY = todayIso();
const dayAfter = (iso, n) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const card = (api, token, over = {}) =>
  api('/cards', {
    method: 'POST',
    token,
    body: {
      network: 'amex',
      tier: 'blue',
      last4: '1234',
      limit: 1000000,
      available: 600000,
      paymentDay: 15,
      ...over,
    },
  });

test('rutas de tarjetas exigen token (401)', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/cards')).status, 401);
  });
});

test('crear: 201, used = limit - available y nombre por defecto', options, async () => {
  await withApi(async (api) => {
    const t = await newUserToken();
    const { status, body } = await card(api, t);
    assert.equal(status, 201);
    assert.equal(body.used, 400000);
    assert.equal(body.available, 600000);
    assert.equal(body.name, 'Amex Blue ••1234');
    const v = await card(api, t, { network: 'visa', tier: 'clasica', last4: '5678' });
    assert.equal(v.body.name, 'Visa Clásica ••5678');
  });
});

test('crear: 422 por datos inválidos y 409 por últimos 4 repetidos', options, async () => {
  await withApi(async (api) => {
    const t = await newUserToken();
    const field = async (over) => (await card(api, t, over)).body.error?.details?.[0]?.field;
    assert.equal((await card(api, t, { last4: '12a4' })).status, 422);
    assert.equal(await field({ available: 2000000 }), 'available');
    assert.equal(await field({ available: -1 }), 'available');
    assert.equal(await field({ network: 'visa', tier: 'blue' }), 'tier');
    assert.equal((await card(api, t)).status, 201);
    const dup = await card(api, t);
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'CARD_EXISTS');
  });
});

test(
  'editar: available -> 422; limit bajo lo usado -> 422; limit válido mantiene lo usado',
  options,
  async () => {
    await withApi(async (api) => {
      const t = await newUserToken();
      const { body: c } = await card(api, t);
      const put = (body) => api(`/cards/${c.id}`, { method: 'PUT', token: t, body });
      assert.equal((await put({ available: 1 })).status, 422);
      const low = await put({ limit: 300000 });
      assert.equal(low.status, 422);
      assert.equal(low.body.error.details[0].field, 'limit');
      const ok = await put({ limit: 2000000 });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.used, 400000);
      assert.equal(ok.body.available, 1600000);
    });
  },
);

test('pago baja lo usado y marca paidThisCycle', options, async () => {
  await withApi(async (api) => {
    const t = await newUserToken();
    const { body: c } = await card(api, t);
    const pay = await api(`/cards/${c.id}/payments`, {
      method: 'POST',
      token: t,
      body: { amount: 100000 },
    });
    assert.equal(pay.status, 201);
    assert.equal(pay.body.card.used, 300000);
    assert.equal(pay.body.card.paidThisCycle, true);
    const mv = await api(`/cards/${c.id}/movements`, { token: t });
    assert.equal(mv.body[0].kind, 'payment');
    assert.equal(
      (await api(`/cards/${c.id}/payments/${pay.body.payment.id}`, { method: 'DELETE', token: t }))
        .status,
      204,
    );
    assert.equal((await api(`/cards/${c.id}`, { token: t })).body.used, 400000);
  });
});

test('sync con disponible menor crea el gasto de cargos y used = banco', options, async () => {
  await withApi(async (api) => {
    const t = await newUserToken();
    const { body: c } = await card(api, t);
    const r = await api(`/cards/${c.id}/sync-with-bank`, {
      method: 'POST',
      token: t,
      body: { available: 500000 },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.card.used, 500000);
    assert.equal(r.body.card.available, 500000);
    const tx = r.body.chargeTransaction;
    assert.equal(tx.description, 'Cargos del banco · Amex Blue ••1234');
    assert.equal(tx.category, 'otros');
    assert.equal(tx.amount, 100000);
    assert.equal(tx.card.id, c.id);
    assert.equal((await api(`/cards/${c.id}`, { token: t })).body.used, 500000);
  });
});

test('sync con disponible mayor no crea gasto y deja un ajuste negativo', options, async () => {
  await withApi(async (api) => {
    const t = await newUserToken();
    const { body: c } = await card(api, t);
    const r = await api(`/cards/${c.id}/sync-with-bank`, {
      method: 'POST',
      token: t,
      body: { available: 700000 },
    });
    assert.equal(r.body.chargeTransaction, null);
    assert.equal(r.body.card.used, 300000);
    const mv = await api(`/cards/${c.id}/movements`, { token: t });
    assert.equal(mv.body[0].kind, 'adjustment');
    assert.equal(mv.body[0].amount, -100000);
  });
});

test('borrar: 204, ya no se lista y el gasto conserva la tarjeta', options, async () => {
  await withApi(async (api) => {
    const t = await newUserToken();
    const { body: c } = await card(api, t);
    const s = await api(`/cards/${c.id}/sync-with-bank`, {
      method: 'POST',
      token: t,
      body: { available: 500000 },
    });
    assert.equal((await api(`/cards/${c.id}`, { method: 'DELETE', token: t })).status, 204);
    assert.equal((await api('/cards', { token: t })).body.length, 0);
    const tx = await api(`/transactions/${s.body.chargeTransaction.id}`, { token: t });
    assert.equal(tx.body.card.id, c.id);
    assert.equal(tx.body.card.deleted, true);
  });
});

test('tarjeta de otro usuario -> 404', options, async () => {
  await withApi(async (api) => {
    const a = await newUserToken();
    const b = await newUserToken();
    const { body: c } = await card(api, a);
    for (const [method, path, body] of [
      ['GET', ''],
      ['PUT', '', { name: 'x' }],
      ['DELETE', ''],
      ['POST', '/payments', { amount: 1 }],
      ['POST', '/sync-with-bank', { available: 1 }],
      ['GET', '/movements'],
    ]) {
      assert.equal(
        (await api(`/cards/${c.id}${path}`, { method, token: b, body })).status,
        404,
        path,
      );
    }
  });
});

test(
  'flujo de la demo: gasto, Ya pagué y Actualizar con el banco no borran el pago del mes',
  options,
  async () => {
    await withApi(async (api) => {
      const { token: t, id: userId } = await newUser();
      const { body: c } = await card(api, t, {
        limit: 3000000,
        available: 2400000,
        paymentDay: 15,
      });
      const tx = await api('/transactions', {
        method: 'POST',
        token: t,
        body: { amount: 16000, description: 'Farmatodo', type: 'gasto', date: TODAY, card: c.id },
      });
      assert.equal(tx.status, 201);
      assert.equal((await api(`/cards/${c.id}`, { token: t })).body.used, 616000);

      const pay = await api(`/cards/${c.id}/payments`, {
        method: 'POST',
        token: t,
        body: { amount: 600000 },
      });
      assert.equal(pay.body.card.paidThisCycle, true);
      assert.equal(pay.body.card.used, 16000);

      const sync = await api(`/cards/${c.id}/sync-with-bank`, {
        method: 'POST',
        token: t,
        body: { available: 2350000 },
      });
      assert.equal(sync.status, 200);
      const synced = sync.body.card;
      assert.equal(synced.used, 650000);
      assert.equal(synced.paidThisCycle, true);
      assert.equal(synced.nextPaymentDate, pay.body.card.nextPaymentDate);

      // El cargo del banco y el pago salen en el historial.
      const mv = (await api(`/cards/${c.id}/movements`, { token: t })).body;
      const chargeId = sync.body.chargeTransaction.id;
      assert.ok(
        mv.some((m) => m.kind === 'purchase' && m.id === chargeId),
        'cargo en movimientos',
      );
      assert.ok(
        mv.some((m) => m.kind === 'payment' && m.id === pay.body.payment.id),
        'pago en movimientos',
      );

      // El calendario del mes del pago lo muestra pagado, con lo que se pagó.
      const cal = await api(`/money-profile/calendar?month=${synced.paidDueDate.slice(0, 7)}`, {
        token: t,
      });
      const ev = cal.body.events.find(
        (e) => e.kind === 'card' && e.id === c.id && e.status === 'pagado',
      );
      assert.ok(ev, 'evento pagado en el calendario');
      assert.equal(ev.date, synced.paidDueDate);
      assert.equal(ev.amount, 600000);

      // Aunque faltaran 3 días, no se recuerda un mes ya pagado.
      const now = new Date();
      const sent = [];
      const scheduler = createReminderScheduler({
        listDueDebts: async () => [],
        listCandidates: async () => [],
        listCardUsers: async () => [
          { id: userId, timezone: 'UTC', time: now.toISOString().slice(11, 16) },
        ],
        listUserCards: async (id) => (await listCards(id)).map((x) => ({ ...x, daysToPayment: 3 })),
        sendToUser: async (id, p) => sent.push([id, p]),
        markCardReminded: async () => {},
        now: () => now,
        log: { info: () => {}, error: (m) => assert.fail(m) },
      });
      await scheduler.tick();
      assert.equal(sent.length, 0);
    });
  },
);

test(
  'sync: el ajuste queda ligado al gasto de cargos; diferencia cero no deja rastro',
  options,
  async () => {
    await withApi(async (api) => {
      const t = await newUserToken();
      const { body: c } = await card(api, t);
      const same = await api(`/cards/${c.id}/sync-with-bank`, {
        method: 'POST',
        token: t,
        body: { available: 600000 },
      });
      assert.equal(same.status, 200);
      assert.equal(same.body.chargeTransaction, null);
      assert.equal(same.body.card.used, 400000);
      assert.deepEqual((await api(`/cards/${c.id}/movements`, { token: t })).body, []);

      const more = await api(`/cards/${c.id}/sync-with-bank`, {
        method: 'POST',
        token: t,
        body: { available: 550000 },
      });
      const { rows: adj } = await pool.query(
        'SELECT diferencia::float8 AS d, transaccion_id AS tx FROM ajustes_tarjeta WHERE tarjeta_id = $1',
        [c.id],
      );
      assert.deepEqual(adj, [{ d: 50000, tx: more.body.chargeTransaction.id }]);
    });
  },
);

test(
  'pago: fecha futura -> 422; fecha anterior a la base no baja lo usado dos veces',
  options,
  async () => {
    await withApi(async (api) => {
      const t = await newUserToken();
      const { body: c } = await card(api, t);
      const pay = (body) => api(`/cards/${c.id}/payments`, { method: 'POST', token: t, body });
      const future = await pay({ amount: 1000, date: dayAfter(TODAY, 1) });
      assert.equal(future.status, 422);
      assert.equal(future.body.error.details[0].field, 'date');
      // El banco ya descontó el pago de ayer: tras sincronizar, anotarlo no vuelve a bajar lo usado.
      await api(`/cards/${c.id}/sync-with-bank`, {
        method: 'POST',
        token: t,
        body: { available: 700000 },
      });
      const late = await pay({ amount: 100000, date: dayAfter(TODAY, -1) });
      assert.equal(late.status, 201);
      assert.equal(late.body.card.used, 300000);
    });
  },
);

test(
  'editar: nombre máximo 40; el nombre por defecto sigue a los dígitos y el nivel',
  options,
  async () => {
    await withApi(async (api) => {
      const t = await newUserToken();
      const { body: c } = await card(api, t);
      const put = (body) => api(`/cards/${c.id}`, { method: 'PUT', token: t, body });
      const long = await put({ name: 'x'.repeat(41) });
      assert.equal(long.status, 422);
      assert.equal(long.body.error.details[0].field, 'name');
      assert.equal((await put({ last4: '9999', tier: 'gold' })).body.name, 'Amex Gold ••9999');
      assert.equal((await put({ name: 'Mi Amex' })).body.name, 'Mi Amex');
      assert.equal((await put({ last4: '8888' })).body.name, 'Mi Amex');
      assert.equal((await put({ name: 'y'.repeat(40) })).status, 200);
    });
  },
);
