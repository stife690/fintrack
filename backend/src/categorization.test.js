import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCategorizer } from './services/categorization.service.js';
import { completeText } from './services/ai-client.service.js';
import { env } from './config/env.js';
import { AppError } from './errors/app-error.js';
import { createApp } from './app.js';
import { signAccessToken } from './services/token.service.js';

/** Catálogo de prueba (mismo contenido que `db/init/02_seed_categorias.sql`, resumido). */
const CATALOG = [
  { id: 1, key: 'alimentacion', name: 'Alimentación', type: 'gasto' },
  { id: 2, key: 'transporte', name: 'Transporte', type: 'gasto' },
  { id: 12, key: 'salario', name: 'Salario', type: 'ingreso' },
];

/**
 * Crea un categorizador con catálogo fijo y una IA simulada.
 * @param {(request: { system: string, prompt: string }) => Promise<string>} ask
 * @returns {ReturnType<typeof createCategorizer>}
 */
function build(ask) {
  return createCategorizer({ listCategories: async () => CATALOG, completeText: ask });
}

const unavailable = async () => {
  throw new AppError(503, 'AI_UNAVAILABLE', 'El servicio de IA no está disponible');
};

test('categoriza con IA cuando la respuesta es una clave del catálogo', async () => {
  const { suggestCategory } = build(async () => 'alimentacion');
  assert.deepEqual(await suggestCategory({ description: 'Almuerzo', type: 'gasto' }), {
    category: 'alimentacion',
    source: 'ia',
  });
});

test('tolera mayúsculas, comillas y puntos en la respuesta del modelo', async () => {
  const { suggestCategory } = build(async () => ' "Transporte". ');
  const result = await suggestCategory({ description: 'Taxi', type: 'gasto' });
  assert.equal(result.category, 'transporte');
});

test('una categoría fuera del catálogo se marca "sin_clasificar"', async () => {
  const { suggestCategory } = build(async () => 'mascotas');
  assert.deepEqual(await suggestCategory({ description: 'Croquetas', type: 'gasto' }), {
    category: null,
    source: 'sin_clasificar',
  });
});

test('una categoría de otro tipo tampoco es válida', async () => {
  const { suggestCategory } = build(async () => 'salario');
  const result = await suggestCategory({ description: 'Cena', type: 'gasto' });
  assert.equal(result.source, 'sin_clasificar');
});

test('si la IA no está disponible se marca "sin_clasificar" sin lanzar error', async () => {
  const { suggestCategory } = build(unavailable);
  assert.deepEqual(await suggestCategory({ description: 'Cena', type: 'gasto' }), {
    category: null,
    source: 'sin_clasificar',
  });
});

test('un error que no es de la IA sí se propaga', async () => {
  const { suggestCategory } = build(async () => {
    throw new Error('bug');
  });
  await assert.rejects(() => suggestCategory({ description: 'Cena', type: 'gasto' }), /bug/);
});

test('el prompt solo incluye descripción y categorías del tipo indicado', async () => {
  let seen;
  const { suggestCategory } = build(async (request) => {
    seen = request;
    return 'salario';
  });
  await suggestCategory({ description: 'Pago quincena', type: 'ingreso' });
  assert.match(seen.prompt, /salario/);
  assert.match(seen.prompt, /Pago quincena/);
  assert.doesNotMatch(seen.prompt, /transporte/);
});

test('resolveCategory respeta la categoría elegida y no llama a la IA', async () => {
  let called = false;
  const { resolveCategory } = build(async () => {
    called = true;
    return 'transporte';
  });
  const result = await resolveCategory({ category: 'salud', description: 'x', type: 'gasto' });
  assert.deepEqual(result, { category: 'salud', source: 'manual' });
  assert.equal(called, false);
});

test('resolveCategory pide a la IA cuando no hay categoría', async () => {
  const { resolveCategory } = build(async () => 'transporte');
  const result = await resolveCategory({ category: null, description: 'Bus', type: 'gasto' });
  assert.deepEqual(result, { category: 'transporte', source: 'ia' });
});

test('cliente de IA: sin API key responde AI_UNAVAILABLE', async () => {
  const previous = env.aiApiKey;
  env.aiApiKey = undefined;
  try {
    await assert.rejects(
      () => completeText({ system: 's', prompt: 'p' }),
      (err) => err.code === 'AI_UNAVAILABLE' && err.statusCode === 503,
    );
  } finally {
    env.aiApiKey = previous;
  }
});

test('cliente de IA: devuelve el texto y envía la clave en la cabecera', async (t) => {
  const previous = env.aiApiKey;
  env.aiApiKey = 'clave-de-prueba';
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    sent = { url, init };
    return Response.json({ content: [{ type: 'text', text: 'alimentacion' }] });
  });
  try {
    assert.equal(await completeText({ system: 's', prompt: 'p' }), 'alimentacion');
    assert.equal(sent.init.headers['x-api-key'], 'clave-de-prueba');
  } finally {
    env.aiApiKey = previous;
  }
});

test('cliente de IA: error HTTP, red caída y respuesta rara dan AI_UNAVAILABLE', async (t) => {
  const previous = env.aiApiKey;
  env.aiApiKey = 'clave-de-prueba';
  t.mock.method(console, 'error', () => {});
  const isUnavailable = (err) => err.code === 'AI_UNAVAILABLE';
  try {
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('x', { status: 500 }),
    );
    for (const behavior of [
      async () => new Response('x', { status: 500 }),
      async () => {
        throw new TypeError('network');
      },
      async () => Response.json({ content: [] }),
    ]) {
      fetchMock.mock.mockImplementation(behavior);
      await assert.rejects(() => completeText({ system: 's', prompt: 'p' }), isUnavailable);
    }
  } finally {
    env.aiApiKey = previous;
  }
});

/**
 * Levanta la app en un puerto libre y ejecuta `fn` con un helper para llamar a la API.
 * @param {(post: (path: string, body: unknown, token?: string) => Promise<{ status: number, body: { error: { code: string, details: Array<{ field: string }> } } }>) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const post = async (path, body, token) => {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    await fn(post);
  } finally {
    server.close();
  }
}

test('POST /categories/suggest sin token responde 401', async () => {
  await withApi(async (post) => {
    const { status, body } = await post('/categories/suggest', { description: 'x', type: 'gasto' });
    assert.equal(status, 401);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });
});

test('POST /categories/suggest valida descripción y tipo (422)', async () => {
  const token = signAccessToken('00000000-0000-0000-0000-000000000001');
  await withApi(async (post) => {
    const { status, body } = await post(
      '/categories/suggest',
      { description: ' ', type: 'x' },
      token,
    );
    assert.equal(status, 422);
    assert.deepEqual(
      body.error.details.map((d) => d.field),
      ['description', 'type'],
    );
  });
});
