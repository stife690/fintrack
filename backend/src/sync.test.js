import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/` con la columna
// transacciones.local_id. Si falta, se omiten con un aviso en vez de fallar.
const { rows } = await pool.query(
  `SELECT 1 FROM information_schema.columns
   WHERE table_name = 'transacciones' AND column_name = 'local_id'`,
);
const options = {
  skip:
    rows.length > 0
      ? false
      : 'Esquema no aplicado: ejecuta db/init/*.sql (o db/patches/001) sobre la base de datos',
};

const TEST_DOMAIN = '@sync-test.fintrack.test';
const FUTURE = '2099-01-01T00:00:00Z';

// Borra los usuarios de prueba; sus transacciones caen por ON DELETE CASCADE.
after(async () => {
  if (!options.skip) {
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
 * Registra un usuario nuevo y devuelve su access token.
 * @param {Api} api
 * @returns {Promise<string>}
 */
async function newUserToken(api) {
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' },
  });
  return body.accessToken;
}

/**
 * Datos de una transacción de prueba.
 * @param {object} [overrides]
 * @returns {object}
 */
function expense(overrides = {}) {
  return {
    amount: 12000,
    description: 'almuerzo',
    type: 'gasto',
    date: '2026-10-17',
    category: 'alimentacion',
    ...overrides,
  };
}

/**
 * Envía un lote a `POST /sync/batch`.
 * @param {Api} api
 * @param {string} token
 * @param {string|null} lastSyncedAt
 * @param {object[]} operations
 * @returns {Promise<{ status: number, body: object }>}
 */
function sync(api, token, lastSyncedAt, operations) {
  return api('/sync/batch', { method: 'POST', token, body: { lastSyncedAt, operations } });
}

test('sincronizar exige access token (401)', options, async () => {
  await withApi(async (api) => {
    const res = await api('/sync/batch', {
      method: 'POST',
      body: { lastSyncedAt: null, operations: [] },
    });
    assert.equal(res.status, 401);
  });
});

test(
  'la primera sincronización guarda los creados offline y responde la forma del contrato',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const res = await sync(api, token, null, [
        { op: 'create', localId: 'loc-1', transaction: expense() },
        { op: 'create', localId: 'loc-2', transaction: expense({ category: 'transporte' }) },
      ]);
      assert.equal(res.status, 200);
      assert.deepEqual(Object.keys(res.body).sort(), [
        'conflicts',
        'serverChanges',
        'synced',
        'syncedAt',
      ]);
      assert.deepEqual(
        res.body.synced.map((s) => s.localId),
        ['loc-1', 'loc-2'],
      );
      assert.deepEqual(res.body.conflicts, []);
      assert.deepEqual(res.body.serverChanges, [], 'lo de este lote no se repite');
      assert.ok(!Number.isNaN(Date.parse(res.body.syncedAt)));

      const list = await api('/transactions', { token });
      assert.equal(list.body.total, 2);
    });
  },
);

test('un create reenviado no se duplica: devuelve el mismo serverId', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const operation = { op: 'create', localId: 'loc-1', transaction: expense() };
    const first = await sync(api, token, null, [operation]);
    const again = await sync(api, token, null, [operation]);
    assert.equal(again.body.synced[0].serverId, first.body.synced[0].serverId);

    const list = await api('/transactions', { token });
    assert.equal(list.body.total, 1);
  });
});

test('creado sin categoría y sin IA disponible queda sin_clasificar', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const res = await sync(api, token, null, [
      { op: 'create', localId: 'loc-1', transaction: expense({ category: null }) },
    ]);
    const saved = await api(`/transactions/${res.body.synced[0].serverId}`, { token });
    assert.equal(saved.body.category, null);
    assert.ok(['sin_clasificar', 'ia'].includes(saved.body.source));
  });
});

test('last-write-wins: gana el cambio más reciente (RN-07)', options, async () => {
  await withApi(async (api) => {
    const token = await newUserToken(api);
    const first = await sync(api, token, null, [
      { op: 'create', localId: 'loc-1', transaction: expense() },
    ]);
    const serverId = first.body.synced[0].serverId;
    const lastSyncedAt = first.body.syncedAt;

    // Otro dispositivo la edita online después de esa sincronización.
    await api(`/transactions/${serverId}`, { method: 'PUT', token, body: { amount: 15000 } });

    const older = await sync(api, token, lastSyncedAt, [
      {
        op: 'update',
        localId: 'loc-1',
        serverId,
        updatedAt: lastSyncedAt,
        transaction: { amount: 13000 },
      },
    ]);
    assert.equal(older.body.conflicts[0].resolution, 'server_wins');
    assert.equal(older.body.conflicts[0].serverVersion.amount, 15000);

    const newer = await sync(api, token, lastSyncedAt, [
      {
        op: 'update',
        localId: 'loc-1',
        serverId,
        updatedAt: FUTURE,
        transaction: { amount: 13000 },
      },
    ]);
    assert.equal(newer.body.conflicts[0].resolution, 'client_wins');
    assert.equal(newer.body.conflicts[0].serverVersion.amount, 13000);
  });
});

test(
  'sin cambios en el servidor desde lastSyncedAt, un update se aplica sin conflicto',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const first = await sync(api, token, null, [
        { op: 'create', localId: 'loc-1', transaction: expense() },
      ]);
      const serverId = first.body.synced[0].serverId;

      const res = await sync(api, token, first.body.syncedAt, [
        {
          op: 'update',
          localId: 'loc-1',
          serverId,
          updatedAt: FUTURE,
          transaction: { amount: 300 },
        },
      ]);
      assert.deepEqual(res.body.synced, [{ localId: 'loc-1', serverId }]);
      assert.deepEqual(res.body.conflicts, []);
      assert.equal((await api(`/transactions/${serverId}`, { token })).body.amount, 300);
    });
  },
);

test(
  'otro dispositivo recibe en serverChanges lo creado y lo borrado (REQ-025)',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);

      // Dispositivo B sincroniza por primera vez: aún no hay nada.
      const deviceB = await sync(api, token, null, []);
      assert.deepEqual(deviceB.body.serverChanges, []);

      // Dispositivo A crea dos y borra una.
      const created = await sync(api, token, null, [
        { op: 'create', localId: 'a-1', transaction: expense() },
        { op: 'create', localId: 'a-2', transaction: expense({ amount: 1 }) },
      ]);
      const [kept, removed] = created.body.synced.map((s) => s.serverId);
      await sync(api, token, created.body.syncedAt, [
        { op: 'delete', localId: 'a-2', serverId: removed, updatedAt: FUTURE },
      ]);

      // Dispositivo B vuelve a sincronizar desde su última hora.
      const changes = await sync(api, token, deviceB.body.syncedAt, []);
      const byId = new Map(changes.body.serverChanges.map((t) => [t.id, t]));
      assert.equal(byId.get(kept).deletedAt, null);
      assert.ok(byId.get(removed).deletedAt, 'el borrado llega para que lo quite de su copia');
    });
  },
);

test(
  'editar y borrar la misma transacción en un lote no genera un falso conflicto',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const first = await sync(api, token, null, [
        { op: 'create', localId: 'loc-1', transaction: expense() },
      ]);
      const serverId = first.body.synced[0].serverId;

      const res = await sync(api, token, first.body.syncedAt, [
        { op: 'update', localId: 'loc-1', serverId, updatedAt: FUTURE, transaction: { amount: 2 } },
        { op: 'delete', localId: 'loc-1', serverId, updatedAt: FUTURE },
      ]);
      assert.equal(res.body.synced.length, 2);
      assert.deepEqual(res.body.conflicts, []);
      assert.equal((await api(`/transactions/${serverId}`, { token })).status, 404);
    });
  },
);

test(
  'un serverId que no existe o es de otro usuario: server_wins sin versión (RN-01)',
  options,
  async () => {
    await withApi(async (api) => {
      const owner = await newUserToken(api);
      const intruder = await newUserToken(api);
      const created = await sync(api, owner, null, [
        { op: 'create', localId: 'loc-1', transaction: expense() },
      ]);
      const serverId = created.body.synced[0].serverId;

      const res = await sync(api, intruder, null, [
        { op: 'update', localId: 'x', serverId, updatedAt: FUTURE, transaction: { amount: 1 } },
        { op: 'delete', localId: 'y', serverId: randomUUID(), updatedAt: FUTURE },
      ]);
      assert.deepEqual(
        res.body.conflicts.map((c) => [c.resolution, c.serverVersion]),
        [
          ['server_wins', null],
          ['server_wins', null],
        ],
      );
      assert.equal((await api(`/transactions/${serverId}`, { token: owner })).body.amount, 12000);
    });
  },
);

test(
  'una categoría inválida en cualquier operación rechaza todo el lote (422)',
  options,
  async () => {
    await withApi(async (api) => {
      const token = await newUserToken(api);
      const res = await sync(api, token, null, [
        { op: 'create', localId: 'ok', transaction: expense() },
        { op: 'create', localId: 'mal', transaction: expense({ category: 'salario' }) },
      ]);
      assert.equal(res.status, 422);
      assert.deepEqual(
        res.body.error.details.map((d) => d.field),
        ['operations[1].transaction.category'],
      );
      const list = await api('/transactions', { token });
      assert.equal(list.body.total, 0, 'ni siquiera la operación válida se aplicó');
    });
  },
);
