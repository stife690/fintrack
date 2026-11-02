import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/` (o el parche 008).
const { rows } = await pool.query("SELECT to_regclass('public.negocio_socios') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@negocios-test.fintrack.test';

// Borra los usuarios de prueba y sus negocios (los negocios no caen solos: su creador queda en NULL).
after(async () => {
  if (!options.skip) {
    await pool.query(
      `DELETE FROM negocios WHERE id IN (
         SELECT s.negocio_id FROM negocio_socios s JOIN usuarios u ON u.id = s.usuario_id
         WHERE u.email LIKE $1)`,
      [`%${TEST_DOMAIN}`],
    );
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
 * Registra un usuario nuevo y devuelve su token, id y correo.
 * @param {Api} api
 * @returns {Promise<{ token: string, id: string, email: string }>}
 */
async function newUser(api) {
  const email = `u-${randomUUID()}${TEST_DOMAIN}`;
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { email, password: 'clave-segura-1' },
  });
  return { token: body.accessToken, id: body.user.id, email };
}

/**
 * Crea un negocio con su dueño, un editor (entra con el código) y un lector (invitado por
 * correo con ese rol).
 * @param {Api} api
 * @returns {Promise<{ owner: object, editor: object, reader: object, business: object }>}
 */
async function businessWithThree(api) {
  const owner = await newUser(api);
  const editor = await newUser(api);
  const reader = await newUser(api);
  const created = await api('/businesses', {
    method: 'POST',
    token: owner.token,
    body: { name: 'Arepas Doña Rosa', nit: '900.123.456-7' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.role, 'dueno');
  const { code } = created.body;
  const joined = await api('/businesses/join', {
    method: 'POST',
    token: editor.token,
    body: { code },
  });
  assert.equal(joined.status, 201);
  assert.equal(joined.body.role, 'editor');

  const invited = await api(`/businesses/${created.body.id}/invitations`, {
    method: 'POST',
    token: owner.token,
    body: { email: reader.email, role: 'lector' },
  });
  assert.equal(invited.status, 201);
  const preview = await api(`/businesses/invitations/${code}`, { token: reader.token });
  assert.equal(preview.body.role, 'lector');
  assert.equal(preview.body.isMember, false);
  const readerJoin = await api('/businesses/join', {
    method: 'POST',
    token: reader.token,
    body: { code },
  });
  assert.equal(readerJoin.body.role, 'lector');
  return { owner, editor, reader, business: created.body };
}

test('todas las rutas de negocios exigen access token (401)', options, async () => {
  await withApi(async (api) => {
    for (const [method, path] of [
      ['GET', '/businesses'],
      ['POST', '/businesses'],
      ['POST', '/businesses/join'],
      ['GET', `/businesses/${randomUUID()}`],
    ]) {
      assert.equal((await api(path, { method })).status, 401, `${method} ${path}`);
    }
  });
});

test(
  'crear, listar y unirse: cada uno con su rol; la invitación usada desaparece',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, editor, reader, business } = await businessWithThree(api);
      const detail = await api(`/businesses/${business.id}`, { token: owner.token });
      assert.equal(detail.status, 200);
      assert.deepEqual(
        detail.body.partners.map((p) => p.role),
        ['dueno', 'editor', 'lector'],
      );
      assert.deepEqual(detail.body.invitations, []);
      assert.equal(detail.body.nit, '900.123.456-7');

      const list = await api('/businesses', { token: editor.token });
      assert.deepEqual(
        list.body.map((b) => [b.id, b.role]),
        [[business.id, 'editor']],
      );

      // Un socio ve a los demás sin su correo ni el código de invitación.
      const asReader = await api(`/businesses/${business.id}`, { token: reader.token });
      assert.equal(asReader.body.code, null);
      assert.ok(!('invitations' in asReader.body));
      assert.equal(asReader.body.partners.find((p) => p.userId === owner.id).email, null);

      // Entrar otra vez con el código no duplica ni cambia el rol (200).
      const again = await api('/businesses/join', {
        method: 'POST',
        token: editor.token,
        body: { code: business.code },
      });
      assert.equal(again.status, 200);
      assert.equal(again.body.membersCount, 3);
    });
  },
);

test('quien no es socio no ve el negocio (404)', options, async () => {
  await withApi(async (api) => {
    const { business } = await businessWithThree(api);
    const stranger = await newUser(api);
    assert.equal((await api(`/businesses/${business.id}`, { token: stranger.token })).status, 404);
    assert.equal((await api('/businesses/no-es-uuid', { token: stranger.token })).status, 404);
    const patch = await api(`/businesses/${business.id}`, {
      method: 'PATCH',
      token: stranger.token,
      body: { name: 'Mío' },
    });
    assert.equal(patch.status, 404);
  });
});

test(
  'solo los dueños editan, invitan, cambian el código y administran socios (403)',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, editor, reader, business } = await businessWithThree(api);
      const base = `/businesses/${business.id}`;
      for (const user of [editor, reader]) {
        const calls = [
          ['PATCH', base, { name: 'Otro nombre' }],
          ['DELETE', base],
          ['POST', `${base}/code`],
          ['POST', `${base}/invitations`, { email: `x-${randomUUID()}${TEST_DOMAIN}` }],
          ['PATCH', `${base}/partners/${owner.id}`, { share: 10 }],
          ['DELETE', `${base}/partners/${owner.id}`],
        ];
        for (const [method, path, body] of calls) {
          const res = await api(path, { method, token: user.token, body });
          assert.equal(res.status, 403, `${method} ${path}`);
        }
      }

      const patch = await api(base, {
        method: 'PATCH',
        token: owner.token,
        body: { name: 'Arepas y Jugos', nit: '' },
      });
      assert.equal(patch.status, 200);
      assert.equal(patch.body.name, 'Arepas y Jugos');
      assert.equal(patch.body.nit, null);

      const changed = await api(`${base}/partners/${editor.id}`, {
        method: 'PATCH',
        token: owner.token,
        body: { role: 'lector' },
      });
      assert.equal(changed.body.partners.find((p) => p.userId === editor.id).role, 'lector');
    });
  },
);

test('participaciones: no pasan de 100 %', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, business } = await businessWithThree(api);
    const url = (id) => `/businesses/${business.id}/partners/${id}`;
    const first = await api(url(owner.id), {
      method: 'PATCH',
      token: owner.token,
      body: { share: 70 },
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.myShare, 70);
    const tooMuch = await api(url(editor.id), {
      method: 'PATCH',
      token: owner.token,
      body: { share: 40 },
    });
    assert.equal(tooMuch.status, 422);
    assert.match(tooMuch.body.error.details[0].problem, /30 %/);
    const ok = await api(url(editor.id), {
      method: 'PATCH',
      token: owner.token,
      body: { share: 30 },
    });
    assert.equal(ok.body.totalShare, 100);
  });
});

test('el negocio nunca se queda sin dueño', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, business } = await businessWithThree(api);
    const url = (id) => `/businesses/${business.id}/partners/${id}`;
    const demote = await api(url(owner.id), {
      method: 'PATCH',
      token: owner.token,
      body: { role: 'editor' },
    });
    assert.equal(demote.status, 409);
    assert.equal(demote.body.error.code, 'LAST_OWNER');
    assert.equal((await api(url(owner.id), { method: 'DELETE', token: owner.token })).status, 409);

    // Con otro dueño, el primero ya puede irse.
    await api(url(editor.id), { method: 'PATCH', token: owner.token, body: { role: 'dueno' } });
    assert.equal((await api(url(owner.id), { method: 'DELETE', token: owner.token })).status, 204);
    assert.equal((await api(`/businesses/${business.id}`, { token: owner.token })).status, 404);
    assert.equal((await api(`/businesses/${business.id}`, { token: editor.token })).status, 200);
  });
});

test('un socio puede salirse; el último en irse elimina el negocio', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, reader, business } = await businessWithThree(api);
    const url = (id) => `/businesses/${business.id}/partners/${id}`;
    assert.equal(
      (await api(url(reader.id), { method: 'DELETE', token: reader.token })).status,
      204,
    );
    assert.equal((await api(url(editor.id), { method: 'DELETE', token: owner.token })).status, 204);
    assert.equal((await api(url(owner.id), { method: 'DELETE', token: owner.token })).status, 204);
    const { rows: left } = await pool.query('SELECT 1 FROM negocios WHERE id = $1', [business.id]);
    assert.equal(left.length, 0);
  });
});

test(
  'invitar: sin repetir a un socio, cancelar y el código viejo deja de servir',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, editor, business } = await businessWithThree(api);
      const base = `/businesses/${business.id}`;
      const email = `nuevo-${randomUUID()}${TEST_DOMAIN}`;
      const res = await api(`${base}/invitations`, {
        method: 'POST',
        token: owner.token,
        body: { email: email.toUpperCase(), role: 'dueno' },
      });
      assert.equal(res.status, 201);
      assert.deepEqual([res.body.email, res.body.role], [email, 'dueno']);

      const repeated = await api(`${base}/invitations`, {
        method: 'POST',
        token: owner.token,
        body: { email: editor.email },
      });
      assert.equal(repeated.status, 409);

      const cancel = await api(`${base}/invitations?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assert.equal(cancel.status, 204);

      const code = await api(`${base}/code`, { method: 'POST', token: owner.token });
      assert.notEqual(code.body.code, business.code);
      const guest = await newUser(api);
      const old = await api('/businesses/join', {
        method: 'POST',
        token: guest.token,
        body: { code: business.code },
      });
      assert.equal(old.status, 404);
    });
  },
);

test('eliminar el negocio lo quita para todos los socios', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, business } = await businessWithThree(api);
    const base = `/businesses/${business.id}`;
    assert.equal((await api(base, { method: 'DELETE', token: owner.token })).status, 204);
    assert.equal((await api(base, { token: editor.token })).status, 404);
    assert.deepEqual((await api('/businesses', { token: editor.token })).body, []);
  });
});
