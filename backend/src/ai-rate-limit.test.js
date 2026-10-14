import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAiRateLimit } from './middlewares/rate-limit.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

test('el límite de IA responde 429 RATE_LIMITED al superar el tope', async () => {
  const app = express();
  app.post('/x', createAiRateLimit({ limit: 2 }), (_req, res) => res.status(201).json({ ok: true }));
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
