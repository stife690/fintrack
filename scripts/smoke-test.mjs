/**
 * Smoke test del despliegue end-to-end (FT-0010). Requiere Node >= 20.
 *
 * Verifica: frontend (200 HTML), `GET /health`, CORS para el origen del
 * frontend y el formato de error 404.
 *
 * Uso:
 *   FRONTEND_URL=https://... API_URL=https://... node scripts/smoke-test.mjs
 *
 * Código de salida: 0 = todo OK, 1 = alguna prueba falló, 2 = faltan variables.
 */

/** URL pública del frontend (Vercel), sin barra final. */
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
/** URL pública del backend (Render), sin barra final. */
const API_URL = (process.env.API_URL || '').replace(/\/$/, '');
/** Tiempo máximo por petición (ms); Render free puede tardar en despertar. */
const TIMEOUT_MS = 60_000;

if (!FRONTEND_URL || !API_URL) {
  console.error('Define FRONTEND_URL y API_URL');
  process.exit(2);
}

/**
 * GET con timeout.
 * @param {string} url URL a consultar.
 * @param {Record<string, string>} [headers] Cabeceras opcionales.
 * @returns {Promise<Response>}
 */
const get = (url, headers = {}) =>
  fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
/**
 * Lanza un error si la condición es falsa.
 * @param {unknown} cond Condición a verificar.
 * @param {string} msg Mensaje del error.
 * @returns {void}
 */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

/** Cantidad de pruebas fallidas. */
let failed = 0;

/**
 * Ejecuta una prueba, imprime ✅/❌ y acumula los fallos.
 * @param {string} name Descripción de la prueba.
 * @param {() => Promise<void>} fn Prueba (lanza si falla).
 * @returns {Promise<void>}
 */
async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}

await check('Frontend responde 200 con HTML', async () => {
  const res = await get(FRONTEND_URL);
  assert(res.status === 200, `status ${res.status}`);
  assert((res.headers.get('content-type') || '').includes('text/html'), 'no es HTML');
});

await check('Backend GET /health responde ok', async () => {
  const res = await get(`${API_URL}/health`);
  assert(res.status === 200, `status ${res.status}`);
  assert((await res.json()).status === 'ok', 'status != ok');
});

await check('CORS permite el origen del frontend', async () => {
  const res = await get(`${API_URL}/health`, { Origin: FRONTEND_URL });
  const allowed = res.headers.get('access-control-allow-origin');
  assert(allowed === FRONTEND_URL || allowed === '*', `Access-Control-Allow-Origin = ${allowed}`);
});

await check('Ruta inexistente responde 404 con formato de error', async () => {
  const res = await get(`${API_URL}/no-existe`);
  assert(res.status === 404, `status ${res.status}`);
  assert((await res.json()).error?.code === 'NOT_FOUND', 'formato de error inesperado');
});

console.log(failed ? `\n${failed} prueba(s) fallaron` : '\nSmoke test OK');
process.exit(failed ? 1 : 0);
