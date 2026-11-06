import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { LEGAL_VERSION } from './config/legal.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';

// Pruebas contra la base real (FT-0017): necesitan las columnas del parche 022.
const { rows } = await pool.query(
  `SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'terminos_version'`,
);
const options = {
  skip: rows.length ? false : 'Falta usuarios.terminos_version: aplica db/patches/022_terminos.sql',
};

const PASSWORD = 'clave-segura-1';
const TEST_DOMAIN = '@terms-test.fintrack.test';

after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre y ejecuta `fn` con un cliente de prueba.
 * @param {(api: (path: string, init?: { method?: string, body?: unknown, token?: string }) => Promise<{ status: number, body: any }>) => Promise<void>} fn
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

/** @returns {string} Correo nuevo del dominio de prueba. */
function newEmail() {
  return `u-${randomUUID()}${TEST_DOMAIN}`;
}

test('el registro exige aceptar los términos (422 acceptTerms)', options, async () => {
  await withApi(async (api) => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: { email: newEmail(), password: PASSWORD },
    });
    assert.equal(res.status, 422);
    assert.deepEqual(
      res.body.error.details.map((d) => d.field),
      ['acceptTerms'],
    );
  });
});

test('al registrarse guarda la versión aceptada y la fecha', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    const res = await api('/auth/register', {
      method: 'POST',
      body: { email, password: PASSWORD, acceptTerms: true },
    });
    assert.equal(res.status, 201);
    const { rows: saved } = await pool.query(
      'SELECT terminos_version, terminos_aceptados_at FROM usuarios WHERE email = $1',
      [email],
    );
    assert.equal(saved[0].terminos_version, LEGAL_VERSION);
    assert.ok(saved[0].terminos_aceptados_at instanceof Date);
  });
});

test(
  'una cuenta sin aceptar la versión vigente la acepta con POST /users/me/terms',
  options,
  async () => {
    await withApi(async (api) => {
      const email = newEmail();
      const { accessToken: token } = await createVerifiedSession({ email, password: PASSWORD });
      // Como una cuenta creada antes de publicar los términos: sin versión aceptada.
      await pool.query(
        'UPDATE usuarios SET terminos_version = NULL, terminos_aceptados_at = NULL WHERE email = $1',
        [email],
      );

      const before = await api('/users/me', { token });
      assert.equal(before.body.termsAccepted, false);

      const old = await api('/users/me/terms', {
        method: 'POST',
        token,
        body: { version: '2000-01-01' },
      });
      assert.equal(old.status, 422, 'solo se acepta la versión vigente');

      const res = await api('/users/me/terms', {
        method: 'POST',
        token,
        body: { version: LEGAL_VERSION },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.termsAccepted, true);
      assert.equal((await api('/users/me', { token })).body.termsAccepted, true);

      const { rows: saved } = await pool.query(
        'SELECT terminos_version, terminos_aceptados_at FROM usuarios WHERE email = $1',
        [email],
      );
      assert.equal(saved[0].terminos_version, LEGAL_VERSION);
      assert.ok(saved[0].terminos_aceptados_at instanceof Date);
    });
  },
);

test('POST /users/me/terms exige sesión (401)', options, async () => {
  await withApi(async (api) => {
    const res = await api('/users/me/terms', { method: 'POST', body: { version: LEGAL_VERSION } });
    assert.equal(res.status, 401);
  });
});
