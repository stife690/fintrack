import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/`.
// Si la tabla `usuarios` no existe se omiten con un aviso en vez de fallar.
const { rows } = await pool.query("SELECT to_regclass('public.usuarios') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const PASSWORD = 'clave-segura-1';
const TEST_DOMAIN = '@auth-test.fintrack.test';

/** @returns {string} Correo único para que las pruebas no choquen entre sí. */
function newEmail() {
  return `u-${randomUUID()}${TEST_DOMAIN}`;
}

// Borra los usuarios creados por las pruebas (sus tokens caen por ON DELETE CASCADE).
after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * Cada llamada crea una app nueva, así que el límite de intentos empieza en cero.
 * @param {(api: (path: string, init?: { method?: string, body?: unknown, token?: string }) => Promise<{ status: number, body: object | null }>) => Promise<void>} fn
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

test('register crea la cuenta y devuelve usuario y tokens (201)', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    const res = await api('/auth/register', {
      method: 'POST',
      body: { email: `  ${email.toUpperCase()} `, password: PASSWORD },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, email, 'el correo se guarda sin espacios y en minúsculas');
    assert.deepEqual(Object.keys(res.body.user).sort(), ['email', 'id']);
    assert.equal(typeof res.body.accessToken, 'string');
    assert.equal(typeof res.body.refreshToken, 'string');

    const saved = await pool.query('SELECT password_hash FROM usuarios WHERE email = $1', [email]);
    assert.match(saved.rows[0].password_hash, /^\$2[aby]\$/, 'la contraseña se guarda con bcrypt');
  });
});

test('register rechaza un correo ya registrado (409 EMAIL_TAKEN)', options, async () => {
  await withApi(async (api) => {
    const body = { email: newEmail(), password: PASSWORD };
    await api('/auth/register', { method: 'POST', body });
    const res = await api('/auth/register', { method: 'POST', body });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });
});

test('register valida las reglas y la forma del cuerpo (422 / 400)', options, async () => {
  await withApi(async (api) => {
    const invalid = await api('/auth/register', {
      method: 'POST',
      body: { email: 'sin-arroba', password: '123' },
    });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(invalid.body.error.details.map((d) => d.field).sort(), ['email', 'password']);

    const malformed = await api('/auth/register', { method: 'POST', body: { email: 123 } });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'VALIDATION_ERROR');
  });
});

test('login entrega tokens y no revela qué campo falló (200 / 401)', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    await api('/auth/register', { method: 'POST', body: { email, password: PASSWORD } });

    const ok = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, email);
    assert.ok(ok.body.accessToken && ok.body.refreshToken);

    const wrongPassword = await api('/auth/login', {
      method: 'POST',
      body: { email, password: 'otra-clave' },
    });
    const unknownEmail = await api('/auth/login', {
      method: 'POST',
      body: { email: newEmail(), password: PASSWORD },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body, 'misma respuesta en ambos casos');
    assert.equal(wrongPassword.body.error.code, 'UNAUTHORIZED');
  });
});

test('refresh rota el token: el usado deja de servir (200 / 401)', options, async () => {
  await withApi(async (api) => {
    const { body: session } = await api('/auth/register', {
      method: 'POST',
      body: { email: newEmail(), password: PASSWORD },
    });
    const body = { refreshToken: session.refreshToken };

    const first = await api('/auth/refresh', { method: 'POST', body });
    assert.equal(first.status, 200);
    assert.ok(first.body.accessToken);
    assert.notEqual(first.body.refreshToken, session.refreshToken);

    const reused = await api('/auth/refresh', { method: 'POST', body });
    assert.equal(reused.status, 401);
    assert.equal(reused.body.error.code, 'UNAUTHORIZED');
  });
});

test('users/me exige un access token válido y vigente', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    const { body: session } = await api('/auth/register', {
      method: 'POST',
      body: { email, password: PASSWORD },
    });

    const me = await api('/users/me', { token: session.accessToken });
    assert.equal(me.status, 200);
    assert.deepEqual(me.body, { id: session.user.id, email, timezone: 'America/Bogota' });

    const noToken = await api('/users/me');
    assert.equal(noToken.status, 401);
    assert.equal(noToken.body.error.code, 'UNAUTHORIZED');

    const forged = jwt.sign({ sub: session.user.id }, 'otro-secreto');
    assert.equal((await api('/users/me', { token: forged })).body.error.code, 'UNAUTHORIZED');

    const expired = jwt.sign({ sub: session.user.id }, env.jwtSecret, { expiresIn: -10 });
    const res = await api('/users/me', { token: expired });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
  });
});

test('logout revoca el refresh token de la sesión (204)', options, async () => {
  await withApi(async (api) => {
    const { body: session } = await api('/auth/register', {
      method: 'POST',
      body: { email: newEmail(), password: PASSWORD },
    });
    const body = { refreshToken: session.refreshToken };

    const noToken = await api('/auth/logout', { method: 'POST', body });
    assert.equal(noToken.status, 401);

    const out = await api('/auth/logout', { method: 'POST', body, token: session.accessToken });
    assert.equal(out.status, 204);

    const afterLogout = await api('/auth/refresh', { method: 'POST', body });
    assert.equal(afterLogout.status, 401);
  });
});

test('login se bloquea al superar el límite de intentos (429 RATE_LIMITED)', options, async () => {
  await withApi(async (api) => {
    // Cuerpo con forma inválida: responde 400 sin tocar la BD, pero cuenta como intento.
    for (let i = 0; i < env.authRateLimitMax; i += 1) {
      const res = await api('/auth/login', { method: 'POST', body: {} });
      assert.equal(res.status, 400);
    }
    const blocked = await api('/auth/login', { method: 'POST', body: {} });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'RATE_LIMITED');

    // refresh no lleva límite: sigue respondiendo su error normal.
    const refresh = await api('/auth/refresh', { method: 'POST', body: { refreshToken: 'x' } });
    assert.equal(refresh.status, 401);
  });
});
