import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import {
  VERIFY_TOKEN_HOURS,
  loginWithGoogle,
  register,
  requestPasswordReset,
  resendVerification,
} from './services/auth.service.js';
import { hashRefreshToken } from './services/token.service.js';

// Verificar el correo al registrarse (FT-0016). Usan la base de datos real: necesitan el esquema
// de `db/init/` (o el parche 013). Si la tabla no existe se omiten con un aviso en vez de fallar.
const { rows } = await pool.query(
  "SELECT to_regclass('public.email_verification_tokens') AS tabla",
);
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: falta la tabla email_verification_tokens',
};

const PASSWORD = 'clave-segura-1';
const TEST_DOMAIN = '@verify-test.fintrack.test';
const GENERIC_MESSAGE = 'Si el correo tiene una cuenta sin confirmar, te enviamos un enlace nuevo.';

/** @returns {string} Correo único para que las pruebas no choquen entre sí. */
function newEmail() {
  return `u-${randomUUID()}${TEST_DOMAIN}`;
}

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
 * Corre `send` con un "correo" falso que guarda lo que se habría enviado, y devuelve el token.
 * @param {(mailer: (mail: object) => Promise<void>) => Promise<unknown>} send
 * @returns {Promise<{ token: string, mail: { to: string, link: string, hours: number } }>}
 */
async function captureLink(send) {
  let mail = null;
  await send(async (sent) => {
    mail = sent;
  });
  assert.ok(mail, 'debió enviarse el correo');
  return { token: mail.link.split('#token=')[1], mail };
}

/**
 * Registra una cuenta (sin verificar) y devuelve el token del enlace que se le envió.
 * @param {string} email
 * @param {string} [password]
 * @returns {Promise<{ token: string, mail: { to: string, link: string, hours: number } }>}
 */
function registerAndCapture(email, password = PASSWORD) {
  return captureLink((mailer) => register({ email, password }, mailer));
}

test(
  'el registro envía el enlace y no deja entrar hasta abrirlo; abrirlo abre sesión',
  options,
  async () => {
    await withApi(async (api) => {
      const email = newEmail();
      const { token, mail } = await registerAndCapture(email);
      assert.equal(mail.to, email);
      assert.equal(mail.hours, VERIFY_TOKEN_HOURS);
      assert.ok(mail.link.startsWith(`${env.appUrl}/verificar#token=`), 'el token va después de #');

      // En la base solo queda la huella del token, nunca el token.
      const saved = await pool.query(
        `SELECT t.token_hash FROM email_verification_tokens t
         JOIN usuarios u ON u.id = t.usuario_id WHERE u.email = $1`,
        [email],
      );
      assert.deepEqual(saved.rows, [{ token_hash: hashRefreshToken(token) }]);

      const blocked = await api('/auth/login', { email, password: PASSWORD });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.error.code, 'EMAIL_NOT_VERIFIED');

      const verified = await api('/auth/verify-email', { token });
      assert.equal(verified.status, 200);
      assert.equal(verified.body.user.email, email);
      assert.ok(verified.body.accessToken && verified.body.refreshToken);

      const login = await api('/auth/login', { email, password: PASSWORD });
      assert.equal(login.status, 200);

      const again = await api('/auth/verify-email', { token });
      assert.equal(again.status, 400, 'cada enlace sirve una sola vez');
      assert.equal(again.body.error.code, 'INVALID_VERIFICATION_TOKEN');
    });
  },
);

test(
  'sin la contraseña correcta no revela que la cuenta falta por verificar (401)',
  options,
  async () => {
    await withApi(async (api) => {
      const email = newEmail();
      await registerAndCapture(email);
      const wrong = await api('/auth/login', { email, password: 'otra-clave' });
      const unknown = await api('/auth/login', { email: newEmail(), password: 'otra-clave' });
      assert.equal(wrong.status, 401);
      assert.deepEqual(wrong.body, unknown.body);
    });
  },
);

test('un enlace vencido no sirve (400 INVALID_VERIFICATION_TOKEN)', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    const { token } = await registerAndCapture(email);
    await pool.query(
      `UPDATE email_verification_tokens SET expires_at = now() - interval '1 minute'
       WHERE token_hash = $1`,
      [hashRefreshToken(token)],
    );

    const res = await api('/auth/verify-email', { token });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_VERIFICATION_TOKEN');
    const login = await api('/auth/login', { email, password: PASSWORD });
    assert.equal(login.status, 403, 'la cuenta sigue sin verificar');
  });
});

test('reenviar manda un enlace nuevo y anula el anterior', options, async () => {
  await withApi(async (api) => {
    const email = newEmail();
    const first = await registerAndCapture(email);
    const second = await captureLink((mailer) => resendVerification(email, mailer));
    assert.notEqual(first.token, second.token);

    const withFirst = await api('/auth/verify-email', { token: first.token });
    assert.equal(withFirst.status, 400);
    const withSecond = await api('/auth/verify-email', { token: second.token });
    assert.equal(withSecond.status, 200);
  });
});

test(
  'reenviar responde lo mismo exista o no la cuenta, y no envía nada si ya está verificada',
  options,
  async () => {
    await withApi(async (api) => {
      const email = newEmail();
      const { token } = await registerAndCapture(email);

      const pending = await api('/auth/resend-verification', { email });
      const unknown = await api('/auth/resend-verification', { email: newEmail() });
      assert.equal(pending.status, 200);
      assert.deepEqual(pending.body, { message: GENERIC_MESSAGE });
      assert.deepEqual(unknown, pending, 'misma respuesta: no revela qué correos existen');

      // El reenvío anuló el enlace del registro: se verifica con uno nuevo.
      assert.equal((await api('/auth/verify-email', { token })).status, 400);
      const fresh = await captureLink((mailer) => resendVerification(email, mailer));
      assert.equal((await api('/auth/verify-email', { token: fresh.token })).status, 200);

      let sent = false;
      await resendVerification(email, async () => {
        sent = true;
      });
      assert.equal(sent, false, 'una cuenta verificada no recibe más enlaces');
    });
  },
);

test(
  'si otra persona registró el correo, entrar con Google le quita la cuenta',
  options,
  async () => {
    await withApi(async (api) => {
      const email = newEmail();
      // Alguien registra el correo de otra persona con su propia contraseña y no puede verificarlo.
      await registerAndCapture(email, 'clave-del-intruso');
      const { rows: before } = await pool.query('SELECT id FROM usuarios WHERE email = $1', [
        email,
      ]);

      // La dueña del correo entra con Google: Google demuestra que el correo es suyo.
      const session = await loginWithGoogle('token', {
        verify: async () => ({ email, name: 'Dueña Real' }),
      });
      assert.equal(session.user.id, before[0].id, 'entra a la misma cuenta');

      const intruder = await api('/auth/login', { email, password: 'clave-del-intruso' });
      assert.equal(intruder.status, 401, 'la contraseña del intruso dejó de servir');
      const { rows: after } = await pool.query(
        'SELECT email_verificado_at FROM usuarios WHERE email = $1',
        [email],
      );
      assert.notEqual(after[0].email_verificado_at, null, 'la cuenta quedó verificada');
    });
  },
);

test(
  'recuperar la contraseña con el enlace del correo también verifica la cuenta',
  options,
  async () => {
    await withApi(async (api) => {
      const email = newEmail();
      await registerAndCapture(email);
      let mail = null;
      await requestPasswordReset(email, async (sent) => {
        mail = sent;
      });
      const token = mail.link.split('#token=')[1];
      const reset = await api('/auth/reset-password', { token, password: 'clave-nueva-2' });
      assert.equal(reset.status, 204);

      const login = await api('/auth/login', { email, password: 'clave-nueva-2' });
      assert.equal(login.status, 200);
    });
  },
);

test('valida el cuerpo de verify-email y resend-verification', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/auth/verify-email', {})).status, 400);
    assert.equal((await api('/auth/verify-email', { token: '' })).status, 400);
    const badEmail = await api('/auth/resend-verification', { email: 'no-es-correo' });
    assert.equal(badEmail.status, 422);
    assert.equal(badEmail.body.error.details[0].field, 'email');
  });
});
