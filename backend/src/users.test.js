import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';

// Pruebas contra la base real. Necesitan la columna `usuarios.nombre`
// (db/init o db/patches/002_usuarios_nombre.sql); si falta, se omiten con un aviso.
const { rows } = await pool.query(
  `SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'nombre'`,
);
const options = {
  skip: rows.length ? false : 'Falta usuarios.nombre: aplica db/patches/002_usuarios_nombre.sql',
};

const PASSWORD = 'clave-segura-1';
const TEST_DOMAIN = '@users-test.fintrack.test';

after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre, crea una cuenta nueva y ejecuta `fn` con su sesión.
 * @param {(ctx: { api: Function, token: string, email: string, password: string }) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withAccount(fn) {
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
    const email = `u-${randomUUID()}${TEST_DOMAIN}`;
    const { body } = await api('/auth/register', {
      method: 'POST',
      body: { email, password: PASSWORD },
    });
    await fn({ api, token: body.accessToken, email, password: PASSWORD });
  } finally {
    server.close();
  }
}

test('PATCH /users/me guarda el nombre limpio y GET /users/me lo devuelve', options, async () => {
  await withAccount(async ({ api, token }) => {
    const res = await api('/users/me', { method: 'PATCH', token, body: { name: '  Ana   María ' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Ana María');

    const me = await api('/users/me', { token });
    assert.equal(me.body.name, 'Ana María');
  });
});

test('el login devuelve el nombre guardado', options, async () => {
  await withAccount(async ({ api, token, email, password }) => {
    await api('/users/me', { method: 'PATCH', token, body: { name: 'Ana' } });
    const login = await api('/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.name, 'Ana');
  });
});

test('PATCH /users/me con null borra el nombre', options, async () => {
  await withAccount(async ({ api, token }) => {
    await api('/users/me', { method: 'PATCH', token, body: { name: 'Ana' } });
    const res = await api('/users/me', { method: 'PATCH', token, body: { name: null } });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, null);
  });
});

test('PATCH /users/me valida el nombre (422) y exige sesión (401)', options, async () => {
  await withAccount(async ({ api, token }) => {
    const tooLong = await api('/users/me', { method: 'PATCH', token, body: { name: 'a'.repeat(61) } });
    assert.equal(tooLong.status, 422);
    assert.equal(tooLong.body.error.details[0].field, 'name');

    const noToken = await api('/users/me', { method: 'PATCH', body: { name: 'Ana' } });
    assert.equal(noToken.status, 401);
  });
});
