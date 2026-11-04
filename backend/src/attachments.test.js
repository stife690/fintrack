import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from './services/attachments.service.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Soportes de pago (FT-0044) por la API, con la base real y el disco de desarrollo. Se omiten si
// falta el parche 014 o si el entorno es de producción (ahí el disco no se usa).
const { rows } = await pool.query("SELECT to_regclass('public.transaccion_soportes') AS tabla");
const options = {
  skip: !rows[0].tabla
    ? 'Esquema no aplicado: falta la tabla transaccion_soportes'
    : env.nodeEnv === 'production' && 'En producción los soportes no usan el disco',
};

const TEST_DOMAIN = '@soportes-test.fintrack.test';
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');
const EXE = Buffer.from('MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000\u0000\u0000', 'latin1');
const users = [];

// Borra los usuarios de prueba (sus movimientos y soportes caen por ON DELETE CASCADE) y sus archivos.
after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
    await Promise.all(
      users.map((id) => rm(path.resolve(env.uploadsDir, id), { recursive: true, force: true })),
    );
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(base: string) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withServer(fn) {
  const server = createApp().listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api/v1`);
  } finally {
    server.close();
  }
}

/**
 * Usuario con un movimiento.
 * @param {string} base
 * @returns {Promise<{ token: string, userId: string, txId: string }>}
 */
async function userWithTransaction(base) {
  const session = await createVerifiedSession({
    email: `u-${randomUUID()}${TEST_DOMAIN}`,
    password: 'clave-segura-1',
  });
  users.push(session.user.id);
  const res = await fetch(`${base}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({
      type: 'gasto',
      amount: 84500,
      description: 'Mercado',
      date: '2026-11-02',
      category: 'alimentacion',
    }),
  });
  return {
    token: session.accessToken,
    userId: session.user.id,
    txId: (await res.json()).transaction.id,
  };
}

/**
 * Sube un archivo y devuelve la respuesta.
 * @param {string} base
 * @param {{ token: string, txId: string }} owner
 * @param {Buffer} data
 * @param {string} [name]
 * @returns {Promise<Response>}
 */
function upload(base, owner, data, name = 'factura.jpg') {
  return fetch(`${base}/transactions/${owner.txId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${owner.token}`,
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(name),
    },
    body: data,
  });
}

const get = (base, token, url) =>
  fetch(base + url, { headers: { Authorization: `Bearer ${token}` } });

test('adjunta una foto, la lista y la devuelve igual', options, async () => {
  await withServer(async (base) => {
    const me = await userWithTransaction(base);
    const created = await upload(base, me, JPG, 'Factura Éxito.jpg');
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.name, 'Factura Éxito.jpg');
    assert.equal(body.type, 'image/jpeg');
    assert.equal(body.size, JPG.length);
    assert.equal(body.key, undefined, 'no revela dónde está guardado');

    const list = await (await get(base, me.token, `/transactions/${me.txId}/attachments`)).json();
    assert.deepEqual(
      list.items.map((a) => a.id),
      [body.id],
    );
    assert.equal(list.max, MAX_ATTACHMENTS);

    const file = await get(base, me.token, `/transactions/${me.txId}/attachments/${body.id}`);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/jpeg');
    assert.equal(file.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), JPG);
  });
});

test('rechaza lo que no es foto ni PDF, y lo que pesa de más', options, async () => {
  await withServer(async (base) => {
    const me = await userWithTransaction(base);
    const exe = await upload(base, me, EXE, 'foto.jpg');
    assert.equal(exe.status, 415);
    assert.equal((await exe.json()).error.code, 'UNSUPPORTED_FILE');

    const big = await upload(base, me, Buffer.concat([PDF, Buffer.alloc(MAX_ATTACHMENT_BYTES)]));
    assert.equal(big.status, 413);
    assert.equal((await big.json()).error.code, 'FILE_TOO_LARGE');

    const list = await (await get(base, me.token, `/transactions/${me.txId}/attachments`)).json();
    assert.equal(list.items.length, 0);
  });
});

test(`permite hasta ${MAX_ATTACHMENTS} soportes por movimiento`, options, async () => {
  await withServer(async (base) => {
    const me = await userWithTransaction(base);
    for (let i = 0; i < MAX_ATTACHMENTS; i += 1) {
      assert.equal((await upload(base, me, PDF, `f${i}.pdf`)).status, 201);
    }
    const extra = await upload(base, me, PDF);
    assert.equal(extra.status, 409);
    assert.equal((await extra.json()).error.code, 'ATTACHMENT_LIMIT');
  });
});

test('nadie más ve ni borra los soportes de otro', options, async () => {
  await withServer(async (base) => {
    const owner = await userWithTransaction(base);
    const other = await userWithTransaction(base);
    const { id } = await (await upload(base, owner, PDF)).json();
    const url = `/transactions/${owner.txId}/attachments`;

    assert.equal((await get(base, other.token, url)).status, 404);
    assert.equal((await get(base, other.token, `${url}/${id}`)).status, 404);
    const del = await fetch(`${base}${url}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${other.token}` },
    });
    assert.equal(del.status, 404);
    assert.equal((await upload(base, { ...other, txId: owner.txId }, PDF)).status, 404);
    assert.equal((await fetch(`${base}${url}`)).status, 401, 'sin sesión');
  });
});

test('borrar un soporte o el movimiento borra también el archivo', options, async () => {
  await withServer(async (base) => {
    const me = await userWithTransaction(base);
    const url = `/transactions/${me.txId}/attachments`;
    const first = await (await upload(base, me, PDF)).json();
    const second = await (await upload(base, me, JPG)).json();
    const fileCount = async () =>
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM transaccion_soportes WHERE usuario_id = $1',
          [me.userId],
        )
      ).rows[0].n;

    const del = await fetch(`${base}${url}/${first.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${me.token}` },
    });
    assert.equal(del.status, 204);
    assert.equal((await get(base, me.token, `${url}/${first.id}`)).status, 404);

    await fetch(`${base}/transactions/${me.txId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${me.token}` },
    });
    assert.equal(await fileCount(), 0, 'el movimiento borrado se lleva sus soportes');
    const { rows: left } = await pool.query('SELECT 1 FROM transaccion_soportes WHERE id = $1', [
      second.id,
    ]);
    assert.equal(left.length, 0);
  });
});
