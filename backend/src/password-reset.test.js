import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { RESET_TOKEN_MINUTES, requestPasswordReset } from './services/auth.service.js';
import { hashRefreshToken } from './services/token.service.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/` (o el parche 004).
// Si la tabla no existe se omiten con un aviso en vez de fallar.
const { rows } = await pool.query("SELECT to_regclass('public.password_reset_tokens') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: falta la tabla password_reset_tokens',
};

const OLD_PASSWORD = 'clave-vieja-1';
const NEW_PASSWORD = 'clave-nueva-2';
const TEST_DOMAIN = '@reset-test.fintrack.test';
const GENERIC_MESSAGE =
  'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.';

/** @returns {string} Correo único para que las pruebas no choquen entre sí. */
function newEmail() {
  return `u-${randomUUID()}${TEST_DOMAIN}`;
}

// Borra los usuarios creados por las pruebas (sus enlaces y tokens caen por ON DELETE CASCADE).
after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor (igual que en auth.test.js).
 * @param {(api: (path: string, body: unknown) => Promise<{ status: number, body: object | null }>) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (path, body) => {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
 * Pide un enlace con un "correo" falso que guarda lo que se habría enviado, y devuelve el token.
 * @param {string} email
 * @returns {Promise<{ token: string, mail: { to: string, link: string, minutes: number } }>}
 */
async function requestToken(email) {
  let mail = null;
  await requestPasswordReset(email, async (sent) => {
    mail = sent;
  });
  assert.ok(mail, 'debió enviarse el correo');
  return { token: mail.link.split('#token=')[1], mail };
}

test(
  'el enlace cambia la contraseña una sola vez y cierra las sesiones abiertas',
  options,
  async () => {
    await withApi(async (api) => {
      const email = newEmail();
      const session = await api('/auth/register', { email, password: OLD_PASSWORD });
      assert.equal(session.status, 201);

      const { token, mail } = await requestToken(email);
      assert.equal(mail.to, email);
      assert.equal(mail.minutes, RESET_TOKEN_MINUTES);
      assert.ok(
        mail.link.startsWith(`${env.appUrl}/restablecer#token=`),
        'el token va después de #',
      );

      // En la base solo queda la huella del token, nunca el token.
      const saved = await pool.query(
        `SELECT t.token_hash FROM password_reset_tokens t
       JOIN usuarios u ON u.id = t.usuario_id WHERE u.email = $1`,
        [email],
      );
      assert.deepEqual(saved.rows, [{ token_hash: hashRefreshToken(token) }]);

      const reset = await api('/auth/reset-password', { token, password: NEW_PASSWORD });
      assert.equal(reset.status, 204);

      const again = await api('/auth/reset-password', { token, password: 'otra-clave-3' });
      assert.equal(again.status, 400);
      assert.equal(again.body.error.code, 'INVALID_RESET_TOKEN');

      const oldLogin = await api('/auth/login', { email, password: OLD_PASSWORD });
      assert.equal(oldLogin.status, 401);
      const newLogin = await api('/auth/login', { email, password: NEW_PASSWORD });
      assert.equal(newLogin.status, 200);

      const oldSession = await api('/auth/refresh', { refreshToken: session.body.refreshToken });
      assert.equal(oldSession.status, 401, 'la sesión de antes del cambio quedó cerrada');
    });
  },
);

test('pedir un enlace nuevo anula el anterior', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    await api('/auth/register', { email, password: OLD_PASSWORD });
    const first = await requestToken(email);
    const second = await requestToken(email);
    assert.notEqual(first.token, second.token);

    const withFirst = await api('/auth/reset-password', {
      token: first.token,
      password: NEW_PASSWORD,
    });
    assert.equal(withFirst.status, 400);
    const withSecond = await api('/auth/reset-password', {
      token: second.token,
      password: NEW_PASSWORD,
    });
    assert.equal(withSecond.status, 204);
  });
});

test('un enlace vencido no sirve (400 INVALID_RESET_TOKEN)', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    await api('/auth/register', { email, password: OLD_PASSWORD });
    const { token } = await requestToken(email);
    await pool.query(
      `UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'
       WHERE token_hash = $1`,
      [hashRefreshToken(token)],
    );

    const res = await api('/auth/reset-password', { token, password: NEW_PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_RESET_TOKEN');
  });
});

test('forgot-password responde lo mismo exista o no la cuenta', options, async (t) => {
  t.mock.method(console, 'info', () => {}); // el correo de desarrollo se imprime en la consola
  await withApi(async (api) => {
    const email = newEmail();
    await api('/auth/register', { email, password: OLD_PASSWORD });

    const registered = await api('/auth/forgot-password', { email });
    const unknown = await api('/auth/forgot-password', { email: newEmail() });
    assert.equal(registered.status, 200);
    assert.deepEqual(registered.body, { message: GENERIC_MESSAGE });
    assert.deepEqual(unknown, registered, 'misma respuesta: no revela qué correos existen');
  });
});

test('sin cuenta no se envía correo', options, async () => {
  let sent = false;
  await requestPasswordReset(newEmail(), async () => {
    sent = true;
  });
  assert.equal(sent, false);
});

test('si el correo falla, la petición no falla: solo queda en el log', options, async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  await withApi(async (api) => {
    const email = newEmail();
    await api('/auth/register', { email, password: OLD_PASSWORD });
    await requestPasswordReset(email, async () => {
      throw new Error('Brevo respondió 401');
    });
    await new Promise((resolve) => setImmediate(resolve)); // deja correr el .catch del envío
    assert.equal(logged.mock.callCount(), 1);
    assert.match(logged.mock.calls[0].arguments[0], /Brevo respondió 401/);
  });
});

test('valida los cuerpos de forgot-password y reset-password', options, async () => {
  await withApi(async (api) => {
    const badEmail = await api('/auth/forgot-password', { email: 'no-es-correo' });
    assert.equal(badEmail.status, 422);
    assert.equal(badEmail.body.error.details[0].field, 'email');

    const noEmail = await api('/auth/forgot-password', {});
    assert.equal(noEmail.status, 400);

    const shortPassword = await api('/auth/reset-password', { token: 'x', password: 'corta' });
    assert.equal(shortPassword.status, 422);
    assert.equal(shortPassword.body.error.details[0].field, 'password');

    const noToken = await api('/auth/reset-password', { password: NEW_PASSWORD });
    assert.equal(noToken.status, 400);

    const madeUp = await api('/auth/reset-password', {
      token: 'inventado',
      password: NEW_PASSWORD,
    });
    assert.equal(madeUp.status, 400);
    assert.equal(madeUp.body.error.code, 'INVALID_RESET_TOKEN');
  });
});
