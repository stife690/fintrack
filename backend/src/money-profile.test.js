import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/`.
const { rows } = await pool.query("SELECT to_regclass('public.compromisos') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@money-profile-test.fintrack.test';
const ARRIENDO = { name: 'Arriendo', amount: 350000, dayOfMonth: 30 };

// Borra los usuarios de prueba; su perfil y compromisos caen por ON DELETE CASCADE.
after(async () => {
  if (!options.skip) await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(api: (path: string, init?: { method?: string, body?: unknown, token?: string }) => Promise<{ status: number, body: object }>) => Promise<void>} fn
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

/** @returns {Promise<string>} Access token de un usuario nuevo. */
async function newUserToken() {
  const body = await createVerifiedSession({
    email: `u-${randomUUID()}${TEST_DOMAIN}`,
    password: 'clave-segura-1',
  });
  return body.accessToken;
}

test('exige sesión', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/money-profile')).status, 401);
  });
});

test('un usuario nuevo tiene un perfil vacío y la bienvenida pendiente', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const { status, body } = await api('/money-profile', { token });
    assert.equal(status, 200);
    assert.deepEqual(body, {
      incomeType: null,
      payDays: [],
      balance: null,
      balanceAt: null,
      money: null,
      totals: { income: 0, expense: 0 },
      welcomeDone: false,
      commitments: [],
    });
  });
});

test('la bienvenida guarda todo de una vez y reintentarla no repite compromisos', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const answers = {
      incomeType: 'fecha_fija',
      payDays: [30, 15, 15],
      balance: 900000,
      commitments: [ARRIENDO, { name: 'Celular', amount: 50000, dayOfMonth: 22 }],
    };
    const first = await api('/money-profile/welcome', { method: 'POST', token, body: answers });
    assert.equal(first.status, 200);
    assert.equal(first.body.welcomeDone, true);
    assert.deepEqual(first.body.payDays, [15, 30]);
    assert.equal(first.body.balance, 900000);
    assert.deepEqual(first.body.commitments.map((c) => c.name), ['Celular', 'Arriendo']);

    const again = await api('/money-profile/welcome', { method: 'POST', token, body: answers });
    assert.equal(again.body.commitments.length, 2);
    assert.equal(again.body.balanceAt, first.body.balanceAt, 'el mismo saldo conserva su hora');
  });
});

test('omitir marca la bienvenida como vista y no borra lo guardado', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const skipped = await api('/money-profile/welcome', { method: 'POST', token });
    assert.equal(skipped.status, 200);
    assert.equal(skipped.body.welcomeDone, true);
    assert.equal(skipped.body.incomeType, null);

    await api('/money-profile', { method: 'PUT', token, body: { incomeType: 'sin_fecha', balance: 1000 } });
    const later = await api('/money-profile/welcome', { method: 'POST', token, body: {} });
    assert.equal(later.body.incomeType, 'sin_fecha');
    assert.equal(later.body.balance, 1000);
  });
});

test('PUT sin fecha limpia los días, y cambiar el saldo actualiza su hora', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const fixed = await api('/money-profile', {
      method: 'PUT',
      token,
      body: { incomeType: 'fecha_fija', payDays: [1], balance: 100 },
    });
    assert.deepEqual(fixed.body.payDays, [1]);

    const same = await api('/money-profile', {
      method: 'PUT',
      token,
      body: { incomeType: 'sin_fecha', payDays: [1], balance: 100 },
    });
    assert.deepEqual(same.body.payDays, []);
    assert.equal(same.body.balanceAt, fixed.body.balanceAt, 'el mismo saldo conserva su hora');

    const changed = await api('/money-profile', { method: 'PUT', token, body: { incomeType: 'sin_fecha', balance: 200 } });
    assert.ok(new Date(changed.body.balanceAt) > new Date(same.body.balanceAt));
  });
});

test('rechaza datos inválidos', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const put = (body) => api('/money-profile', { method: 'PUT', token, body });
    assert.equal((await put({ incomeType: 'otro' })).status, 422);
    assert.equal((await put({ incomeType: 'fecha_fija', payDays: [] })).status, 422);
    assert.equal((await put({ incomeType: 'fecha_fija', payDays: [32] })).status, 422);
    assert.equal((await put({ balance: -1 })).status, 422);
    assert.equal((await put([])).status, 400);

    const post = (body) => api('/money-profile/commitments', { method: 'POST', token, body });
    assert.equal((await post({ ...ARRIENDO, name: ' ' })).status, 422);
    assert.equal((await post({ ...ARRIENDO, amount: 0 })).status, 422);
    assert.equal((await post({ ...ARRIENDO, dayOfMonth: 0 })).status, 422);
  });
});

test('crea, cambia y elimina compromisos sin repetir nombres', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const path = '/money-profile/commitments';
    const created = await api(path, { method: 'POST', token, body: ARRIENDO });
    assert.equal(created.status, 201);
    const repeated = await api(path, { method: 'POST', token, body: { ...ARRIENDO, name: ' arriendo ' } });
    assert.equal(repeated.status, 409);
    assert.equal(repeated.body.error.code, 'COMMITMENT_EXISTS');

    const other = await api(path, { method: 'POST', token, body: { ...ARRIENDO, name: 'Internet' } });
    const clash = await api(`${path}/${other.body.id}`, { method: 'PUT', token, body: ARRIENDO });
    assert.equal(clash.status, 409);

    const edited = await api(`${path}/${created.body.id}`, {
      method: 'PUT',
      token,
      body: { ...ARRIENDO, amount: 400000 },
    });
    assert.equal(edited.body.amount, 400000);

    assert.equal((await api(`${path}/${created.body.id}`, { method: 'DELETE', token })).status, 204);
    assert.equal((await api(`${path}/${created.body.id}`, { method: 'DELETE', token })).status, 404);
    assert.equal((await api(`${path}/no-es-un-id`, { method: 'DELETE', token })).status, 404);
  });
});

test('no deja ver ni tocar los compromisos de otro usuario', options, async () => {
  await withApi(async (api) => {
    const [alice, bob] = [await newUserToken(), await newUserToken()];
    const path = '/money-profile/commitments';
    const { body } = await api(path, { method: 'POST', token: alice, body: ARRIENDO });

    assert.deepEqual((await api('/money-profile', { token: bob })).body.commitments, []);
    assert.equal((await api(`${path}/${body.id}`, { method: 'PUT', token: bob, body: ARRIENDO })).status, 404);
    assert.equal((await api(`${path}/${body.id}`, { method: 'DELETE', token: bob })).status, 404);
  });
});

test('el plan empieza sin datos y se calcula con lo registrado después del saldo', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    assert.deepEqual((await api('/money-profile/plan', { token })).body, { ready: false });

    await api('/money-profile', { method: 'PUT', token, body: { incomeType: 'sin_fecha', balance: 500000 } });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    const add = (type, amount, date) =>
      api('/transactions', {
        method: 'POST',
        token,
        body: { type, amount, date, description: 'Prueba', category: type === 'gasto' ? 'otros' : 'otros_ingresos' },
      });
    assert.equal((await add('gasto', 100000, today)).status, 201);
    await add('ingreso', 30000, today);
    await add('gasto', 70000, '2020-01-15');

    const { status, body } = await api('/money-profile/plan', { token });
    assert.equal(status, 200);
    assert.equal(body.money, 430000, 'el gasto con fecha vieja ya estaba en el saldo');
    assert.equal(body.ledger, -140000);

    const profile = await api('/money-profile', { token });
    assert.equal(profile.body.money, 430000, 'el perfil y el plan dicen lo mismo');
    assert.deepEqual(profile.body.totals, { income: 30000, expense: 170000 });
  });
});

test('corregir el saldo al mismo número reinicia la cuenta', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const put = (body) => api('/money-profile', { method: 'PUT', token, body });
    await put({ incomeType: 'sin_fecha', balance: 1000000, resetBalance: true });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    await api('/transactions', {
      method: 'POST',
      token,
      body: { type: 'ingreso', amount: 200000, date: today, description: 'Prueba', category: 'otros_ingresos' },
    });

    const untouched = await put({ incomeType: 'sin_fecha', balance: 1000000 });
    assert.equal(untouched.body.money, 1200000, 'cambiar otra cosa no reinicia la cuenta');

    const corrected = await put({ incomeType: 'sin_fecha', balance: 1000000, resetBalance: true });
    assert.equal(corrected.body.money, 1000000);
  });
});

test('sin corregir, la plata sale de los movimientos; al corregir, del saldo', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const put = (body) => api('/money-profile', { method: 'PUT', token, body });
    await put({ incomeType: 'sin_fecha', balance: 1000000 });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    await api('/transactions', {
      method: 'POST',
      token,
      body: { type: 'ingreso', amount: 7000000, date: today, description: 'Prueba', category: 'otros_ingresos' },
    });
    assert.equal((await api('/money-profile/plan', { token })).body.money, 7000000);

    await put({ incomeType: 'sin_fecha', balance: 1000000, resetBalance: true });
    assert.equal((await api('/money-profile/plan', { token })).body.money, 1000000);
  });
});

test('limita los compromisos por usuario', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken();
    const commitments = Array.from({ length: 30 }, (_, i) => ({ ...ARRIENDO, name: `Pago ${i}` }));
    await api('/money-profile/welcome', { method: 'POST', token, body: { commitments } });
    const extra = await api('/money-profile/commitments', { method: 'POST', token, body: ARRIENDO });
    assert.equal(extra.status, 409);
    assert.equal(extra.body.error.code, 'COMMITMENT_LIMIT');
  });
});
