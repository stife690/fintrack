import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { MAX_IDEAS_PER_DAY } from './services/ideas.service.js';

// Estas pruebas usan la base de datos real: necesitan el esquema de `db/init/` (o el parche 009).
const { rows } = await pool.query("SELECT to_regclass('public.idea_votos') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@ideas-test.fintrack.test';
const TEST_MARK = 'prueba-ideas';

after(async () => {
  if (!options.skip) {
    await pool.query('DELETE FROM ideas WHERE titulo LIKE $1', [`${TEST_MARK}%`]);
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(api: (path: string, init?: { method?: string, body?: unknown, token?: string }) => Promise<{ status: number, body: object }>) => Promise<void>} fn
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

async function newUser(api) {
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' },
  });
  return { token: body.accessToken, id: body.user.id };
}

/** Publica una idea directo en la base, como lo hace el equipo. */
async function publishedIdea(status = 'planeada') {
  const { rows: created } = await pool.query(
    'INSERT INTO ideas (titulo, estado) VALUES ($1, $2) RETURNING id',
    [`${TEST_MARK} ${randomUUID()}`, status],
  );
  return created[0].id;
}

const find = (ideas, id) => [...ideas.upcoming, ...ideas.done].find((idea) => idea.id === id);

test('sin sesión no se pueden ver ni enviar ideas', options, async () => {
  await withApi(async (api) => {
    assert.equal((await api('/ideas')).status, 401);
    assert.equal((await api('/ideas', { method: 'POST', body: { title: 'Una idea' } })).status, 401);
  });
});

test('una idea enviada queda en revisión y no se muestra ni a quien la envió', options, async () => {
  await withApi(async (api) => {
    const user = await newUser(api);
    const created = await api('/ideas', {
      method: 'POST',
      token: user.token,
      body: { title: `${TEST_MARK} dividir el arriendo` },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'revision');
    const { body } = await api('/ideas', { token: user.token });
    assert.equal(find(body, created.body.id), undefined);
  });
});

test('las ideas públicas no revelan quién las envió', options, async () => {
  await withApi(async (api) => {
    const user = await newUser(api);
    const id = await publishedIdea();
    const { body } = await api('/ideas', { token: user.token });
    assert.deepEqual(Object.keys(find(body, id)).sort(), ['id', 'status', 'title', 'voted', 'votes']);
  });
});

test('cada persona vota una sola vez y puede quitar su voto', options, async () => {
  await withApi(async (api) => {
    const first = await newUser(api);
    const second = await newUser(api);
    const id = await publishedIdea();
    const vote = (user) => api(`/ideas/${id}/vote`, { method: 'POST', token: user.token });

    assert.equal((await vote(first)).status, 204);
    assert.equal((await vote(first)).status, 204);
    await vote(second);
    let { body } = await api('/ideas', { token: first.token });
    assert.equal(find(body, id).votes, 2);
    assert.equal(find(body, id).voted, true);

    assert.equal((await api(`/ideas/${id}/vote`, { method: 'DELETE', token: first.token })).status, 204);
    ({ body } = await api('/ideas', { token: first.token }));
    assert.equal(find(body, id).votes, 1);
    assert.equal(find(body, id).voted, false);
  });
});

test('no se vota por ideas en revisión, listas o inexistentes', options, async () => {
  await withApi(async (api) => {
    const user = await newUser(api);
    const ids = [await publishedIdea('revision'), await publishedIdea('lista'), randomUUID(), 'no-es-un-id'];
    for (const id of ids) {
      const { status } = await api(`/ideas/${id}/vote`, { method: 'POST', token: user.token });
      assert.equal(status, 404);
    }
  });
});

test('una lista se muestra aparte de lo que viene', options, async () => {
  await withApi(async (api) => {
    const user = await newUser(api);
    const planned = await publishedIdea('en_progreso');
    const done = await publishedIdea('lista');
    const { body } = await api('/ideas', { token: user.token });
    assert.ok(body.upcoming.some(({ id }) => id === planned));
    assert.ok(body.done.some(({ id }) => id === done));
  });
});

test('un título inválido responde 422 y el exceso de ideas 429', options, async () => {
  await withApi(async (api) => {
    const user = await newUser(api);
    const send = (title) => api('/ideas', { method: 'POST', token: user.token, body: { title } });
    assert.equal((await send('hola')).status, 422);
    for (let i = 0; i < MAX_IDEAS_PER_DAY; i += 1) {
      assert.equal((await send(`${TEST_MARK} número ${i}`)).status, 201);
    }
    const limited = await send(`${TEST_MARK} de más`);
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
  });
});
