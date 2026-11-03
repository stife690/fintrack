import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

// Cabeceras de seguridad de la API (FT-0042). No necesitan la base de datos: usan rutas que no
// la tocan (404, 401 y la petición previa de CORS).
after(() => pool.end());

const EXPECTED = {
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=15552000; includeSubDomains',
};

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(baseUrl: string) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withServer(fn) {
  const server = createApp().listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

/**
 * Comprueba que la respuesta trae todas las cabeceras y no anuncia Express.
 * @param {Response} res
 * @param {string} label Qué respuesta es, para el mensaje si falla.
 * @returns {void}
 */
function assertSecure(res, label) {
  for (const [name, value] of Object.entries(EXPECTED)) {
    assert.equal(res.headers.get(name), value, `${label}: ${name}`);
  }
  assert.equal(res.headers.get('x-powered-by'), null, `${label}: no anuncia Express`);
}

test('las respuestas de error y los 404 llevan las cabeceras de seguridad', async () => {
  await withServer(async (base) => {
    const notFound = await fetch(`${base}/api/v1/no-existe`);
    assert.equal(notFound.status, 404);
    assertSecure(notFound, '404');

    const unauthorized = await fetch(`${base}/api/v1/users/me`);
    assert.equal(unauthorized.status, 401);
    assertSecure(unauthorized, '401');
  });
});

test('CORS sigue funcionando para el frontend con las cabeceras puestas', async () => {
  await withServer(async (base) => {
    const preflight = await fetch(`${base}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        // Un origen permitido: el primero de CORS_ORIGIN, o cualquiera si no está configurado.
        Origin: env.corsOrigins[0] ?? 'https://fintrack.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.ok(preflight.headers.get('access-control-allow-origin'), 'responde la petición previa');
    assertSecure(preflight, 'preflight');
  });
});
