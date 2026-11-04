import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { createAccountService } from './services/account.service.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Eliminar la cuenta (FT-0017) con la base real: se arma un usuario con de todo (movimiento con
// soporte, tarjeta con compra, vacas y negocios propios y compartidos, una invitación a su correo)
// y se comprueba qué se borra y qué sigue para los demás.
const { rows } = await pool.query("SELECT to_regclass('public.tarjetas') AS tabla");
const options = {
  skip: !rows[0].tabla
    ? 'Esquema no aplicado: falta la tabla tarjetas'
    : env.nodeEnv === 'production' && 'En producción los soportes no usan el disco',
};

const TEST_DOMAIN = '@cuenta-test.fintrack.test';
const PASSWORD = 'clave-segura-1';
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);

after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app, ejecuta `fn` con un cliente JSON y cierra el servidor.
 * @param {(api: (url: string, init?: { method?: string, token?: string, body?: unknown, raw?: Buffer, headers?: object }) => Promise<{ status: number, body: object|null }>) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (url, { method = 'GET', token, body, raw, headers = {} } = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        ...(raw ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
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

/** @returns {Promise<{ token: string, id: string, email: string }>} */
async function newUser() {
  const email = `u-${randomUUID()}${TEST_DOMAIN}`;
  const session = await createVerifiedSession({ email, password: PASSWORD });
  return { token: session.accessToken, id: session.user.id, email };
}

/**
 * Cuántas filas de `table` cumplen `where` (con `$1` = `value`).
 * @param {string} table
 * @param {string} where
 * @param {unknown} value
 * @returns {Promise<number>}
 */
async function count(table, where, value) {
  const { rows: r } = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, [
    value,
  ]);
  return r[0].n;
}

/** @typedef {(url: string, init?: object) => Promise<{ status: number, body: object|null }>} Api */

/**
 * Usuario que se va a ir, con datos en todas partes, y un amigo con quien comparte.
 * @param {Api} api
 * @returns {Promise<object>} Los dos usuarios y los ids de lo que se revisa después.
 */
async function userWithEverything(api) {
  const me = await newUser();
  const friend = await newUser();
  const post = (url, token, body) => api(url, { method: 'POST', token, body });

  const card = await post('/cards', me.token, {
    network: 'visa',
    tier: 'gold',
    last4: '4321',
    limit: 2000000,
    available: 2000000,
    paymentDay: 10,
  });
  assert.equal(card.status, 201);
  const tx = await post('/transactions', me.token, {
    type: 'gasto',
    amount: 84500,
    description: 'Mercado',
    date: '2026-11-02',
    category: 'alimentacion',
    card: card.body.id,
  });
  assert.equal(tx.status, 201);
  const upload = await api(`/transactions/${tx.body.transaction.id}/attachments`, {
    method: 'POST',
    token: me.token,
    raw: JPG,
    headers: { 'Content-Type': 'image/jpeg', 'X-File-Name': 'factura.jpg' },
  });
  assert.equal(upload.status, 201);

  const shared = await post('/vacas', me.token, { name: 'Paseo', goal: 400000 });
  assert.equal((await post('/vacas/join', friend.token, { code: shared.body.code })).status, 201);
  assert.equal(
    (
      await post(`/vacas/${shared.body.id}/contributions`, me.token, {
        amount: 50000,
        date: '2026-11-02',
      })
    ).status,
    201,
  );
  const alone = await post('/vacas', me.token, { name: 'Solo mía', goal: 100000 });

  const business = await post('/businesses', me.token, { name: 'Arepas' });
  assert.equal(
    (await post('/businesses/join', friend.token, { code: business.body.code })).status,
    201,
  );
  const soloBusiness = await post('/businesses', me.token, { name: 'Mío solo' });

  const friendsVaca = await post('/vacas', friend.token, { name: 'Cumpleaños', goal: 90000 });
  assert.equal(
    (await post(`/vacas/${friendsVaca.body.id}/invitations`, friend.token, { email: me.email }))
      .status,
    201,
  );

  return {
    me,
    friend,
    fileKey: (
      await pool.query('SELECT ruta FROM transaccion_soportes WHERE usuario_id = $1', [me.id])
    ).rows[0].ruta,
    sharedVaca: shared.body.id,
    aloneVaca: alone.body.id,
    business: business.body.id,
    soloBusiness: soloBusiness.body.id,
  };
}

test('DELETE /users/me exige token (401)', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/users/me', { method: 'DELETE', body: {} })).status, 401);
  });
});

test(
  'sin confirmación o con las dos: 422; con la contraseña mal: 403 y no borra nada',
  options,
  async () => {
    await withApi(async (api) => {
      const me = await newUser();
      const del = (body) => api('/users/me', { method: 'DELETE', token: me.token, body });

      assert.equal((await del({})).status, 422);
      assert.equal((await del({ password: PASSWORD, googleCredential: 'x' })).status, 422);
      const wrong = await del({ password: 'otra-clave-1' });
      assert.equal(wrong.status, 403);
      assert.equal(wrong.body.error.code, 'CONFIRMATION_FAILED');
      assert.equal((await api('/users/me', { token: me.token })).status, 200);
    });
  },
);

test(
  'con la contraseña: borra la cuenta y sus datos, y lo compartido sigue para los demás',
  options,
  async () => {
    await withApi(async (api) => {
      const s = await userWithEverything(api);

      const res = await api('/users/me', {
        method: 'DELETE',
        token: s.me.token,
        body: { password: PASSWORD },
      });
      assert.equal(res.status, 204);

      // Ya no entra: ni con el token que tenía ni con su contraseña.
      assert.equal((await api('/users/me', { token: s.me.token })).status, 401);
      const login = await api('/auth/login', {
        method: 'POST',
        body: { email: s.me.email, password: PASSWORD },
      });
      assert.equal(login.status, 401);

      // Lo suyo ya no está.
      for (const table of ['transacciones', 'tarjetas', 'transaccion_soportes', 'refresh_tokens']) {
        assert.equal(await count(table, 'usuario_id = $1', s.me.id), 0, table);
      }
      assert.equal(await count('vaca_invitaciones', 'lower(email) = $1', s.me.email), 0);
      await assert.rejects(access(path.resolve(env.uploadsDir, s.fileKey)), { code: 'ENOENT' });

      // Lo que solo era suyo se borró; lo compartido sigue y el amigo ahora lo administra.
      assert.equal(await count('vacas', 'id = $1', s.aloneVaca), 0);
      assert.equal(await count('negocios', 'id = $1', s.soloBusiness), 0);
      const vaca = await api(`/vacas/${s.sharedVaca}`, { token: s.friend.token });
      assert.equal(vaca.status, 200);
      const { rows: roles } = await pool.query(
        `SELECT (SELECT rol FROM vaca_miembros WHERE vaca_id = $1 AND usuario_id = $3) AS vaca,
              (SELECT rol FROM negocio_socios WHERE negocio_id = $2 AND usuario_id = $3) AS negocio`,
        [s.sharedVaca, s.business, s.friend.id],
      );
      assert.deepEqual(roles[0], { vaca: 'admin', negocio: 'dueno' });

      // Su aporte a la vaca compartida queda, sin nombre: lo reunido no cambia.
      const { rows: aportes } = await pool.query(
        'SELECT usuario_id, monto::float AS monto FROM vaca_aportes WHERE vaca_id = $1',
        [s.sharedVaca],
      );
      assert.deepEqual(aportes, [{ usuario_id: null, monto: 50000 }]);
    });
  },
);

test('con Google: solo sirve la misma cuenta de Google', options, async () => {
  const me = await newUser();
  const deleted = [];
  const service = createAccountService({
    verifier: {
      async verify(credential) {
        return { email: credential === 'mia' ? me.email : `otra${TEST_DOMAIN}` };
      },
    },
    sendEmail: async (mail) => deleted.push(mail.to),
  });

  await assert.rejects(service.remove(me.id, { googleCredential: 'ajena' }), {
    statusCode: 403,
    code: 'CONFIRMATION_FAILED',
  });
  assert.equal(await count('usuarios', 'id = $1', me.id), 1);

  await service.remove(me.id, { googleCredential: 'mia' });
  assert.equal(await count('usuarios', 'id = $1', me.id), 0);
  assert.deepEqual(deleted, [me.email]);
});
