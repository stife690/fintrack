// Smoke test del despliegue end-to-end (FT-0010). Requiere Node >= 20.
// Uso: FRONTEND_URL=https://... API_URL=https://... node scripts/smoke-test.mjs
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
const API_URL = (process.env.API_URL || '').replace(/\/$/, '');
const TIMEOUT_MS = 60_000; // Render free puede tardar en despertar

if (!FRONTEND_URL || !API_URL) {
  console.error('Define FRONTEND_URL y API_URL');
  process.exit(2);
}

const get = (url, headers = {}) =>
  fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

let failed = 0;
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
