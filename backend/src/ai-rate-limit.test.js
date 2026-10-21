import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAiRateLimit } from './middlewares/rate-limit.middleware.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';

test('el límite de IA responde 429 RATE_LIMITED al superar el tope', async () => {
  const app = express();
  app.post('/x', createAiRateLimit({ limit: 2 }), (_req, res) =>
    res.status(201).json({ ok: true }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/x`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 201);
    assert.equal((await fetch(url, { method: 'POST' })).status, 201);
    const blocked = await fetch(url, { method: 'POST' });
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  } finally {
    server.close();
  }
});

test('/sync/batch: un lote vacío no cuenta para el límite de IA; uno con operaciones sí', async () => {
  const previous = env.aiRateLimitMax;
  env.aiRateLimitMax = 2;
  const server = createApp().listen(0);
  env.aiRateLimitMax = previous;
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/v1/sync/batch`;
    // El límite se revisa antes que el token: sin token, 401 mientras no se pase del tope.
    const send = (operations) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSyncedAt: null, operations }),
      }).then((r) => r.status);
    for (let i = 0; i < 5; i++)
      assert.equal(await send([]), 401, 'un lote vacío no debe llegar a 429');
    const op = [{ op: 'create', localId: 'x' }];
    assert.equal(await send(op), 401);
    assert.equal(await send(op), 401);
    assert.equal(await send(op), 429);
  } finally {
    server.close();
  }
});
