import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { loginWithGoogle, register } from './services/auth.service.js';
import { createGoogleVerifier } from './services/google-auth.service.js';

// Las pruebas con base de datos se omiten si no está el esquema de `db/init/`.
const { rows } = await pool.query("SELECT to_regclass('public.usuarios') AS tabla");
const dbOptions = { skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql' };

const TEST_DOMAIN = '@google-test.fintrack.test';
const newEmail = () => `g-${randomUUID()}${TEST_DOMAIN}`;

after(async () => {
  if (!dbOptions.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/** Cliente de Google falso: devuelve `payload` o lanza como lo haría una firma inválida. */
const fakeClient = (payload) => ({
  verifyIdToken: async ({ audience }) => {
    if (!payload) throw new Error('Invalid token signature');
    assert.equal(audience, 'cliente-123.apps.googleusercontent.com');
    return { getPayload: () => payload };
  },
});

const verifierFor = (payload) =>
  createGoogleVerifier({
    clientId: 'cliente-123.apps.googleusercontent.com',
    client: fakeClient(payload),
  });

// ---------------------------------------------------------------- verificador

test('el verificador devuelve el correo (en minúsculas) y el nombre de un token válido', async () => {
  const verifier = verifierFor({
    email: 'Ana@Gmail.com',
    email_verified: true,
    name: ' Ana Pérez ',
  });
  assert.deepEqual(await verifier.verify('token'), { email: 'ana@gmail.com', name: 'Ana Pérez' });
  const sinNombre = verifierFor({ email: 'b@gmail.com', email_verified: true });
  assert.deepEqual(await sinNombre.verify('token'), { email: 'b@gmail.com', name: null });
});

test('el verificador rechaza tokens inválidos o con el correo sin verificar (401)', async () => {
  for (const verifier of [
    verifierFor(null),
    verifierFor({ email: 'a@gmail.com', email_verified: false }),
    verifierFor({ email_verified: true }),
  ]) {
    await assert.rejects(
      () => verifier.verify('token'),
      (err) => err.statusCode === 401 && err.code === 'UNAUTHORIZED',
    );
  }
});

test('sin GOOGLE_CLIENT_ID el verificador responde 503', async () => {
  const verifier = createGoogleVerifier({ clientId: undefined, client: fakeClient({}) });
  await assert.rejects(
    () => verifier.verify('token'),
    (err) => err.statusCode === 503 && err.code === 'GOOGLE_NOT_CONFIGURED',
  );
});

// ---------------------------------------------------------------- servicio (con BD)

test(
  'loginWithGoogle crea la cuenta la primera vez y reutiliza la misma después',
  dbOptions,
  async () => {
    const email = newEmail();
    const verifier = { verify: async () => ({ email, name: 'Ana Pérez' }) };

    const first = await loginWithGoogle('token', verifier);
    assert.equal(first.user.email, email);
    assert.equal(first.user.name, 'Ana Pérez');
    assert.ok(first.accessToken && first.refreshToken);

    const second = await loginWithGoogle('token', verifier);
    assert.equal(second.user.id, first.user.id, 'es la misma cuenta');
    assert.notEqual(second.refreshToken, first.refreshToken);
  },
);

test(
  'loginWithGoogle entra a la cuenta existente con ese correo sin cambiarle el nombre',
  dbOptions,
  async () => {
    const email = newEmail();
    const created = await register({ email, password: 'clave-segura-1' });
    const session = await loginWithGoogle('token', {
      verify: async () => ({ email, name: 'Otro Nombre' }),
    });
    assert.equal(session.user.id, created.user.id);
    assert.equal(session.user.name, created.user.name);
  },
);

test('la cuenta creada con Google no se puede abrir con una contraseña', dbOptions, async () => {
  const email = newEmail();
  await loginWithGoogle('token', { verify: async () => ({ email, name: null }) });
  const server = createApp().listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: '' }),
    });
    assert.notEqual(res.status, 200);
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------- HTTP

test(
  'POST /auth/google: sin credential → 400; sin GOOGLE_CLIENT_ID → 503',
  { skip: env.googleClientId ? 'GOOGLE_CLIENT_ID definido' : false },
  async () => {
    const server = createApp().listen(0);
    const post = (body) =>
      fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    try {
      assert.equal((await post({})).status, 400);
      assert.equal((await post({ credential: 5 })).status, 400);
      const res = await post({ credential: 'cualquier-cosa' });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error.code, 'GOOGLE_NOT_CONFIGURED');
    } finally {
      server.close();
    }
  },
);
