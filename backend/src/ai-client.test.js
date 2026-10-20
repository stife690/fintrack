import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_API_KEY = 'clave-de-prueba';
process.env.AI_PROVIDER = 'gemini';
const { completeText } = await import('./services/ai-client.service.js');

const gemini = (text) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });

/** Sustituye fetch por una secuencia de respuestas (o errores) y cuenta las llamadas. */
async function withFetch(steps, fn) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    const step = steps[calls++];
    if (step instanceof Error) throw step;
    return step;
  };
  try {
    return await fn(() => calls);
  } finally {
    globalThis.fetch = original;
  }
}

const ask = () => completeText({ system: 's', prompt: 'p' });

test('reintenta una vez ante un error de red y devuelve la respuesta', async () => {
  await withFetch([new TypeError('fetch failed'), gemini('alimentacion')], async (calls) => {
    assert.equal(await ask(), 'alimentacion');
    assert.equal(calls(), 2);
  });
});

test('reintenta una vez ante un 5xx del proveedor', async () => {
  await withFetch([new Response('{}', { status: 503 }), gemini('transporte')], async (calls) => {
    assert.equal(await ask(), 'transporte');
    assert.equal(calls(), 2);
  });
});

test('si el reintento también falla responde AI_UNAVAILABLE sin más intentos', async () => {
  await withFetch([new TypeError('x'), new TypeError('y'), gemini('nunca')], async (calls) => {
    await assert.rejects(ask(), { statusCode: 503, code: 'AI_UNAVAILABLE' });
    assert.equal(calls(), 2);
  });
});

test('no reintenta ante un 4xx (clave, cuota o petición inválida)', async () => {
  await withFetch([new Response('{}', { status: 400 }), gemini('nunca')], async (calls) => {
    await assert.rejects(ask(), { code: 'AI_UNAVAILABLE' });
    assert.equal(calls(), 1);
  });
});
