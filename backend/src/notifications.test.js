import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { budgetNotice } from './services/budgets.service.js';
import { safeUrl } from './services/notifications.service.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Centro de notificaciones (FT-0045) con la base real: avisos de presupuesto (una vez por nivel)
// y los push de las vacas, que ahora también quedan en la bandeja.
const { rows } = await pool.query("SELECT to_regclass('public.notificaciones') AS tabla");
const options = { skip: !rows[0].tabla && 'Esquema no aplicado: falta la tabla notificaciones' };

const TEST_DOMAIN = '@avisos-test.fintrack.test';
// En la zona del usuario de prueba (Bogotá): en UTC ya es mañana desde las 7 p. m.
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const MONTH = TODAY.slice(0, 7);

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

test('las rutas de avisos exigen token (401)', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/notifications')).status, 401);
    assert.equal((await api('/notifications/read', { method: 'POST' })).status, 401);
  });
});

test(
  'un presupuesto avisa una sola vez al 80 % y otra al pasarse; leerlos baja el contador',
  options,
  async () => {
    await withApi(async (api) => {
      const me = await newUser();
      const budget = await api('/budgets', {
        method: 'POST',
        token: me.token,
        body: { category: 'alimentacion', month: MONTH, amount: 100000 },
      });
      assert.equal(budget.status, 201);
      const spend = (amount) =>
        api('/transactions', {
          method: 'POST',
          token: me.token,
          body: {
            type: 'gasto',
            amount,
            description: 'Mercado',
            date: TODAY,
            category: 'alimentacion',
          },
        });

      assert.equal((await spend(50000)).status, 201); // 50 %: nada
      assert.equal((await api('/notifications', { token: me.token })).body.unread, 0);

      assert.equal((await spend(35000)).body.alert.level, 'warning_80'); // 85 %
      assert.equal((await spend(5000)).body.alert.level, 'warning_80'); // 90 %: no repite
      assert.equal((await spend(20000)).body.alert.level, 'exceeded_100'); // 110 %

      const inbox = await api('/notifications', { token: me.token });
      assert.equal(inbox.status, 200);
      assert.equal(inbox.body.unread, 2);
      assert.deepEqual(
        inbox.body.items.map((n) => [n.title, n.read, n.url]),
        [
          ['Presupuesto de Alimentación', false, '/app/presupuestos'],
          ['Presupuesto de Alimentación', false, '/app/presupuestos'],
        ],
      );
      assert.match(inbox.body.items[0].body, /^Te pasaste: llevas el 110 %/);
      assert.match(inbox.body.items[1].body, /^Ya llevas el 85 %/);

      assert.equal(
        (await api('/notifications/read', { method: 'POST', token: me.token })).status,
        204,
      );
      const read = await api('/notifications', { token: me.token });
      assert.equal(read.body.unread, 0);
      assert.ok(read.body.items.every((n) => n.read));
    });
  },
);

test('el aviso de las vacas queda en la bandeja aunque no haya push activo', options, async () => {
  await withApi(async (api) => {
    const admin = await newUser();
    const friend = await newUser();
    const vaca = await api('/vacas', {
      method: 'POST',
      token: admin.token,
      body: { name: 'Paseo', goal: 300000 },
    });
    const join = await api('/vacas/join', {
      method: 'POST',
      token: friend.token,
      body: { code: vaca.body.code },
    });
    assert.equal(join.status, 201);

    // El push de la vaca sale sin esperar la respuesta: se espera a que llegue a la bandeja.
    let inbox;
    for (let i = 0; i < 20; i += 1) {
      inbox = await api('/notifications', { token: admin.token });
      if (inbox.body.unread > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(inbox.body.unread, 1);
    assert.equal(inbox.body.items[0].title, 'Paseo');
    assert.match(inbox.body.items[0].body, /se unió a la vaca/);
    assert.equal(inbox.body.items[0].url, `/app/vacas/${vaca.body.id}`);
    // Quien se unió no recibe aviso de sí mismo.
    assert.equal((await api('/notifications', { token: friend.token })).body.unread, 0);
  });
});

test('los avisos solo llevan a rutas de la app y dicen el porcentaje redondeado', () => {
  assert.equal(safeUrl('/app/vacas/1'), '/app/vacas/1');
  for (const bad of ['https://otro.com', '//otro.com', 'app', null, `/${'x'.repeat(200)}`]) {
    assert.equal(safeUrl(bad), null, String(bad));
  }
  assert.deepEqual(
    budgetNotice({
      categoryName: 'Transporte',
      month: '2026-11',
      level: 'warning_80',
      percentage: 80.4,
    }),
    {
      title: 'Presupuesto de Transporte',
      body: 'Ya llevas el 80 % de lo que pusiste para noviembre.',
      url: '/app/presupuestos',
    },
  );
});
