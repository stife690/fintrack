import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from './middlewares/error.middleware.js';
import { validationError, notFoundError } from './errors/app-error.js';

/**
 * Levanta una app mínima con rutas de prueba y el manejador central de errores.
 *
 * @param {(baseUrl: string) => Promise<void>} fn Prueba que recibe la URL base.
 * @returns {Promise<void>}
 */
async function withErrorApp(fn) {
  const app = express();
  app.use(express.json());
  app.get('/app-error', () => {
    throw validationError('Datos inválidos', [{ field: 'amount', issue: 'requerido' }]);
  });
  app.get('/not-found', () => {
    throw notFoundError();
  });
  app.get('/boom', () => {
    throw new Error('detalle interno secreto');
  });
  app.post('/json', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('AppError se serializa con estado, código y details', async () => {
  await withErrorApp(async (base) => {
    const res = await fetch(`${base}/app-error`);
    const body = await res.json();
    assert.equal(res.status, 422);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(body.error.details, [{ field: 'amount', issue: 'requerido' }]);
  });
});

test('AppError sin details no incluye la clave details', async () => {
  await withErrorApp(async (base) => {
    const res = await fetch(`${base}/not-found`);
    const body = await res.json();
    assert.equal(res.status, 404);
    assert.equal('details' in body.error, false);
  });
});

test('JSON mal formado responde 400 INVALID_JSON', async () => {
  await withErrorApp(async (base) => {
    const res = await fetch(`${base}/json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{mal',
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error.code, 'INVALID_JSON');
  });
});

test('un error inesperado responde 500 INTERNAL_ERROR', async (t) => {
  t.mock.method(console, 'error', () => {});
  await withErrorApp(async (base) => {
    const res = await fetch(`${base}/boom`);
    const body = await res.json();
    assert.equal(res.status, 500);
    assert.equal(body.error.code, 'INTERNAL_ERROR');
  });
});
