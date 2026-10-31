import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/` (o el parche 007).
const { rows } = await pool.query("SELECT to_regclass('public.vaca_aportes') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@vacas-test.fintrack.test';

// Borra los usuarios de prueba y sus vacas (las vacas no caen solas: su creador queda en NULL).
after(async () => {
  if (!options.skip) {
    await pool.query(
      `DELETE FROM vacas WHERE id IN (
         SELECT m.vaca_id FROM vaca_miembros m JOIN usuarios u ON u.id = m.usuario_id
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

/** @returns {string} Hoy en Bogotá (AAAA-MM-DD), la zona por defecto de los usuarios. */
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

/**
 * Crea una vaca con su dueño y un segundo miembro que entra con el código.
 * @param {Api} api
 * @param {object} [overrides]
 * @returns {Promise<{ owner: object, member: object, vaca: object }>}
 */
async function vacaWithTwo(api, overrides = {}) {
  const owner = await newUser(api);
  const member = await newUser(api);
  const created = await api('/vacas', {
    method: 'POST',
    token: owner.token,
    body: { name: 'Paseo a Melgar', goal: 400000, ...overrides },
  });
  assert.equal(created.status, 201);
  const joined = await api('/vacas/join', {
    method: 'POST',
    token: member.token,
    body: { code: created.body.code },
  });
  assert.equal(joined.status, 201);
  return { owner, member, vaca: joined.body };
}

test('todas las rutas de vacas exigen access token (401)', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/vacas')).status, 401);
    assert.equal((await api('/vacas', { method: 'POST', body: {} })).status, 401);
    assert.equal(
      (await api('/vacas/join', { method: 'POST', body: { code: 'ABCDEF' } })).status,
      401,
    );
  });
});

test(
  'crear una vaca: 201, el creador queda de administrador y aparece en su lista',
  options,
  async () => {
    await withApi(async (api) => {
      const owner = await newUser(api);
      const res = await api('/vacas', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Regalo de mamá', goal: 300000, description: 'Para el cumpleaños' },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.role, 'admin');
      assert.equal(res.body.membersCount, 1);
      assert.equal(res.body.myQuota, 300000);
      assert.match(res.body.code, /^[A-Z0-9]{6}$/);
      assert.deepEqual(res.body.invitations, []);

      const list = await api('/vacas', { token: owner.token });
      assert.equal(list.status, 200);
      assert.equal(list.body.length, 1);
      assert.equal(list.body[0].id, res.body.id);
      assert.ok(!('members' in list.body[0]));

      const invalid = await api('/vacas', {
        method: 'POST',
        token: owner.token,
        body: { name: '' },
      });
      assert.equal(invalid.status, 422);
      const past = await api('/vacas', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Vieja', goal: 10, deadline: '2020-01-01' },
      });
      assert.equal(past.status, 422);
    });
  },
);

test(
  'unirse con el código: vista previa, 201 la primera vez y 200 si ya era miembro',
  options,
  async () => {
    await withApi(async (api) => {
      const owner = await newUser(api);
      const guest = await newUser(api);
      const { body: vaca } = await api('/vacas', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Mercado', goal: 200000 },
      });

      const preview = await api(`/vacas/invitations/${vaca.code.toLowerCase()}`, {
        token: guest.token,
      });
      assert.equal(preview.status, 200);
      assert.equal(preview.body.name, 'Mercado');
      assert.equal(preview.body.isMember, false);
      assert.equal(preview.body.membersCount, 1);

      const first = await api('/vacas/join', {
        method: 'POST',
        token: guest.token,
        body: { code: vaca.code },
      });
      assert.equal(first.status, 201);
      assert.equal(first.body.role, 'miembro');
      assert.equal(first.body.membersCount, 2);
      assert.equal(first.body.myQuota, 100000, 'reparto igual entre los dos');

      const again = await api('/vacas/join', {
        method: 'POST',
        token: guest.token,
        body: { code: vaca.code },
      });
      assert.equal(again.status, 200);

      const unknown = await api('/vacas/join', {
        method: 'POST',
        token: guest.token,
        body: { code: 'ZZZZZZ' },
      });
      assert.equal(unknown.status, 404);
    });
  },
);

test('quien no es miembro no ve la vaca (404, RN-01)', options, async () => {
  await withApi(async (api) => {
    const { vaca } = await vacaWithTwo(api);
    const stranger = await newUser(api);
    assert.equal((await api(`/vacas/${vaca.id}`, { token: stranger.token })).status, 404);
    const contribute = await api(`/vacas/${vaca.id}/contributions`, {
      method: 'POST',
      token: stranger.token,
      body: { amount: 1000, date: today() },
    });
    assert.equal(contribute.status, 404);
    assert.equal((await api('/vacas/no-es-uuid', { token: stranger.token })).status, 404);
  });
});

test(
  'aportar suma al total y deja un gasto en los movimientos; reenviar el localId no duplica',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, member, vaca } = await vacaWithTwo(api);
      const localId = randomUUID();
      const body = { amount: 50000, date: today(), note: 'Mi parte', localId };

      const res = await api(`/vacas/${vaca.id}/contributions`, {
        method: 'POST',
        token: member.token,
        body,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.contribution.amount, 50000);
      assert.equal(res.body.contribution.note, 'Mi parte');
      assert.equal(res.body.transaction.type, 'gasto');
      assert.equal(res.body.transaction.category, 'ahorro_inversion');
      assert.equal(res.body.transaction.source, 'manual');
      assert.match(res.body.transaction.description, /Paseo a Melgar/);
      assert.equal(res.body.vaca.total, 50000);
      assert.equal(res.body.vaca.myContributed, 50000);
      assert.equal(res.body.vaca.myRemaining, 150000);

      const retry = await api(`/vacas/${vaca.id}/contributions`, {
        method: 'POST',
        token: member.token,
        body,
      });
      assert.equal(retry.status, 201);
      assert.equal(retry.body.vaca.total, 50000, 'el reenvío no suma otra vez');
      assert.equal(retry.body.transaction.id, res.body.transaction.id);

      const tx = await api(`/transactions/${res.body.transaction.id}`, { token: member.token });
      assert.equal(tx.status, 200);
      assert.equal(tx.body.amount, 50000);

      // El administrador ve el aporte del otro miembro con su nombre visible (sin el correo).
      const detail = await api(`/vacas/${vaca.id}`, { token: owner.token });
      assert.equal(detail.body.total, 50000);
      assert.equal(detail.body.contributions.length, 1);
      assert.equal(detail.body.contributions[0].isMe, false);
      assert.equal(detail.body.contributions[0].name, member.email.split('@')[0]);
      assert.ok(!JSON.stringify(detail.body.members).includes(TEST_DOMAIN), 'no expone correos');
    });
  },
);

test('aporte con otra categoría de gasto, fecha futura o categoría inválida', options, async () => {
  await withApi(async (api) => {
    const { member, vaca } = await vacaWithTwo(api);
    const ok = await api(`/vacas/${vaca.id}/contributions`, {
      method: 'POST',
      token: member.token,
      body: { amount: 1000, date: today(), category: 'entretenimiento' },
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.transaction.category, 'entretenimiento');

    const future = await api(`/vacas/${vaca.id}/contributions`, {
      method: 'POST',
      token: member.token,
      body: { amount: 1000, date: '2999-01-01' },
    });
    assert.equal(future.status, 422);

    const income = await api(`/vacas/${vaca.id}/contributions`, {
      method: 'POST',
      token: member.token,
      body: { amount: 1000, date: today(), category: 'salario' },
    });
    assert.equal(income.status, 422);
    assert.equal(income.body.error.details[0].field, 'category');
  });
});

test('solo quien aportó puede borrar su aporte, y se borra también su gasto', options, async () => {
  await withApi(async (api) => {
    const { owner, member, vaca } = await vacaWithTwo(api);
    const { body } = await api(`/vacas/${vaca.id}/contributions`, {
      method: 'POST',
      token: member.token,
      body: { amount: 30000, date: today() },
    });
    const path = `/vacas/${vaca.id}/contributions/${body.contribution.id}`;

    assert.equal((await api(path, { method: 'DELETE', token: owner.token })).status, 403);

    const removed = await api(path, { method: 'DELETE', token: member.token });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.transactionId, body.transaction.id);
    assert.equal(
      (await api(`/transactions/${body.transaction.id}`, { token: member.token })).status,
      404,
    );
    assert.equal((await api(`/vacas/${vaca.id}`, { token: owner.token })).body.total, 0);
    assert.equal((await api(path, { method: 'DELETE', token: member.token })).status, 404);
  });
});

test('editar, cuotas personalizadas y roles: solo administradores', options, async () => {
  await withApi(async (api) => {
    const { owner, member, vaca } = await vacaWithTwo(api);

    const denied = await api(`/vacas/${vaca.id}`, {
      method: 'PATCH',
      token: member.token,
      body: { goal: 1 },
    });
    assert.equal(denied.status, 403);

    const noSplit = await api(`/vacas/${vaca.id}/members/${member.id}`, {
      method: 'PATCH',
      token: owner.token,
      body: { quota: 100000 },
    });
    assert.equal(noSplit.status, 422, 'con reparto igual no se ponen cuotas');

    const edited = await api(`/vacas/${vaca.id}`, {
      method: 'PATCH',
      token: owner.token,
      body: { split: 'personalizado', name: 'Paseo a Girardot' },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.name, 'Paseo a Girardot');

    const quota = await api(`/vacas/${vaca.id}/members/${member.id}`, {
      method: 'PATCH',
      token: owner.token,
      body: { quota: 100000 },
    });
    assert.equal(quota.status, 200);
    const quotas = Object.fromEntries(quota.body.members.map((m) => [m.userId, m.quota]));
    assert.equal(quotas[member.id], 100000);
    assert.equal(quotas[owner.id], 300000, 'al resto le toca lo que falta');

    const lastAdmin = await api(`/vacas/${vaca.id}/members/${owner.id}`, {
      method: 'PATCH',
      token: owner.token,
      body: { role: 'miembro' },
    });
    assert.equal(lastAdmin.status, 409);
    assert.equal(lastAdmin.body.error.code, 'LAST_ADMIN');

    const back = await api(`/vacas/${vaca.id}`, {
      method: 'PATCH',
      token: owner.token,
      body: { split: 'igual' },
    });
    assert.ok(
      back.body.members.every((m) => m.customQuota === null),
      'reparto igual borra las cuotas',
    );
  });
});

test('invitar por correo: 201, sin repetir a un miembro', options, async () => {
  await withApi(async (api) => {
    const { owner, member, vaca } = await vacaWithTwo(api);
    const email = `nuevo-${randomUUID()}${TEST_DOMAIN}`;
    const res = await api(`/vacas/${vaca.id}/invitations`, {
      method: 'POST',
      token: member.token,
      body: { email: email.toUpperCase() },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, email);

    const detail = await api(`/vacas/${vaca.id}`, { token: owner.token });
    assert.deepEqual(
      detail.body.invitations.map((i) => i.email),
      [email],
    );
    assert.ok(!('invitations' in (await api(`/vacas/${vaca.id}`, { token: member.token })).body));

    const repeated = await api(`/vacas/${vaca.id}/invitations`, {
      method: 'POST',
      token: owner.token,
      body: { email: member.email },
    });
    assert.equal(repeated.status, 409);

    const cancel = await api(`/vacas/${vaca.id}/invitations?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
      token: owner.token,
    });
    assert.equal(cancel.status, 204);
  });
});

test('cambiar el código invalida el anterior', options, async () => {
  await withApi(async (api) => {
    const { owner, vaca } = await vacaWithTwo(api);
    const res = await api(`/vacas/${vaca.id}/code`, { method: 'POST', token: owner.token });
    assert.equal(res.status, 200);
    assert.notEqual(res.body.code, vaca.code);
    const guest = await newUser(api);
    const old = await api('/vacas/join', {
      method: 'POST',
      token: guest.token,
      body: { code: vaca.code },
    });
    assert.equal(old.status, 404);
  });
});

test(
  'consejo para el grupo y recordatorio a los atrasados (uno cada 12 horas)',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, member, vaca } = await vacaWithTwo(api);
      const advice = await api(`/vacas/${vaca.id}/advice`, { token: member.token });
      assert.equal(advice.status, 200);
      assert.ok(advice.body.advice.length > 0);
      assert.ok(['ia', 'reglas'].includes(advice.body.source));

      assert.equal(
        (await api(`/vacas/${vaca.id}/reminders`, { method: 'POST', token: member.token })).status,
        403,
      );
      const sent = await api(`/vacas/${vaca.id}/reminders`, { method: 'POST', token: owner.token });
      assert.equal(sent.status, 200);
      assert.equal(sent.body.reminded, 1);
      const again = await api(`/vacas/${vaca.id}/reminders`, {
        method: 'POST',
        token: owner.token,
      });
      assert.equal(again.status, 429);
      assert.equal(again.body.error.code, 'REMINDER_RECENT');
    });
  },
);

test(
  'salirse: el aporte se conserva; si se va el único administrador, pasa a otro; sin nadie se borra',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, member, vaca } = await vacaWithTwo(api);
      await api(`/vacas/${vaca.id}/contributions`, {
        method: 'POST',
        token: owner.token,
        body: { amount: 10000, date: today() },
      });

      assert.equal(
        (
          await api(`/vacas/${vaca.id}/members/${owner.id}`, {
            method: 'DELETE',
            token: member.token,
          })
        ).status,
        403,
      );
      const left = await api(`/vacas/${vaca.id}/members/${owner.id}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assert.equal(left.status, 204);

      const detail = await api(`/vacas/${vaca.id}`, { token: member.token });
      assert.equal(detail.body.role, 'admin', 'el miembro que queda pasa a administrador');
      assert.equal(detail.body.total, 10000, 'el aporte de quien se fue sigue contando');

      await api(`/vacas/${vaca.id}/members/${member.id}`, {
        method: 'DELETE',
        token: member.token,
      });
      const { rows: still } = await pool.query('SELECT 1 FROM vacas WHERE id = $1', [vaca.id]);
      assert.equal(still.length, 0, 'sin miembros, la vaca se elimina');
    });
  },
);

test(
  'eliminar la vaca: solo administradores; el gasto del aporte se conserva',
  options,
  async () => {
    await withApi(async (api) => {
      const { owner, member, vaca } = await vacaWithTwo(api);
      const { body } = await api(`/vacas/${vaca.id}/contributions`, {
        method: 'POST',
        token: member.token,
        body: { amount: 5000, date: today() },
      });
      assert.equal(
        (await api(`/vacas/${vaca.id}`, { method: 'DELETE', token: member.token })).status,
        403,
      );
      assert.equal(
        (await api(`/vacas/${vaca.id}`, { method: 'DELETE', token: owner.token })).status,
        204,
      );
      assert.equal((await api(`/vacas/${vaca.id}`, { token: owner.token })).status, 404);
      assert.equal(
        (await api(`/transactions/${body.transaction.id}`, { token: member.token })).status,
        200,
      );
    });
  },
);
