import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AppError } from '../errors/app-error.js';
import { errorHandler } from './error.middleware.js';

/**
 * Levanta una app mínima con rutas que fallan a propósito y el `errorHandler`,
 * ejecuta `fn` y cierra el servidor. No necesita base de datos.
 *
 * @param {(baseUrl: string) => Promise<void>} fn Prueba que recibe la URL base.
 * @returns {Promise<void>}
 */
async function withServer(fn) {
  const app = express();
  app.use(express.json());
  app.post('/eco', (req, res) => res.json(req.body));
  app.get('/negocio', () => {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'amount', problem: 'Debe ser un número mayor que 0' },
    ]);
  });
  app.get('/bug', async () => {
    throw new Error('detalle interno que no debe salir');
  });
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('JSON mal formado responde 400 VALIDATION_ERROR', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/eco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ esto no es json',
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});

test('un AppError responde con su código HTTP, code y details', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/negocio`);
    const body = await res.json();
    assert.equal(res.status, 422);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(body.error.details, [
      { field: 'amount', problem: 'Debe ser un número mayor que 0' },
    ]);
  });
});

test('un error inesperado responde 500 sin exponer detalles internos', async (t) => {
  // Silencia el console.error esperado para no ensuciar la salida de las pruebas.
  t.mock.method(console, 'error', () => {});
  await withServer(async (base) => {
    const res = await fetch(`${base}/bug`);
    const body = await res.json();
    assert.equal(res.status, 500);
    assert.deepEqual(body, {
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
    });
  });
});
