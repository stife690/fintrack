import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

async function withServer(fn) {
  const server = createApp().listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('GET /health responde 200 con status ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
  });
});

test('una ruta inexistente responde 404 con el formato de error', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/no-existe`);
    const body = await res.json();
    assert.equal(res.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
