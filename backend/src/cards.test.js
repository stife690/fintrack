import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';

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
  const body = await createVerifiedSession({
    email: `u-${randomUUID()}${TEST_DOMAIN}`,
    password: 'clave-segura-1',
  });
  return body.accessToken;
}

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
