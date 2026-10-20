/**
 * Casos de prueba de la sincronización offline con conexión intermitente (FT-0009).
 * Los casos y sus resultados están documentados en `docs/pruebas-sincronizacion.md`.
 *
 * Requiere:
 *   - Backend y base de datos: `docker compose up -d` (API en :3000).
 *   - Frontend compilado: `npm run build && npx vite preview --port 5173` (el service worker
 *     solo existe en el build; 5173 es el origen que permite CORS en local).
 *   - Google Chrome instalado (puppeteer-core no descarga navegador).
 *
 * Uso (desde `frontend/`):
 *   npm run test:sync
 *   CHROME_PATH=/ruta/a/chrome APP_URL=http://localhost:5173 API_URL=http://localhost:3000 npm run test:sync
 *
 * Crea un usuario de prueba por caso (`sync.*@fintrack.dev`), así que usa 12 de los 20 intentos
 * de registro permitidos cada 15 min: para repetirlo enseguida, reinicia el backend local.
 *
 * Código de salida: 0 = todos los casos pasan, 1 = alguno falló.
 */
import puppeteer from 'puppeteer-core';

/** Ruta de Chrome por sistema operativo; `CHROME_PATH` la reemplaza. */
const DEFAULT_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux: '/usr/bin/google-chrome',
}[process.platform];

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const API = `${(process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/v1`;
const PASSWORD = 'prueba1234';
const results = [];

const post = (path, body, token) =>
  fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  }).then((r) => r.json());

async function newUser(tag) {
  const email = `sync.${tag}.${Date.now()}@fintrack.dev`;
  // El registro ya devuelve la sesión: un solo intento por usuario (límite de 20 cada 15 min).
  const session = await post('/auth/register', { email, password: PASSWORD });
  if (!session.accessToken) throw new Error(`registro falló: ${JSON.stringify(session)}`);
  return session;
}

/** Movimientos del usuario en el servidor cuya descripción contiene `q`. */
async function serverRows(session, q = '') {
  const query = q ? `&q=${encodeURIComponent(q)}` : '';
  const res = await fetch(`${API}/transactions?pageSize=100${query}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const body = await res.json();
  if (!body.data) throw new Error(`consulta al servidor falló: ${JSON.stringify(body)}`);
  return body.data;
}

const browser = await puppeteer.launch({
  protocolTimeout: 60000,
  executablePath: process.env.CHROME_PATH || DEFAULT_CHROME,
  headless: true,
});

/** Abre la app con sesión en un "dispositivo" (contexto aislado: su propio IndexedDB y SW). */
async function openApp(context, session, path = '/app/transacciones') {
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message));
  await page.goto(`${APP}/login`);
  await page.evaluate((s) => localStorage.setItem('fintrack.session', JSON.stringify(s)), session);
  await page.goto(APP + path, { waitUntil: 'networkidle0' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle0' });
  return page;
}

async function register(page, description, amount = 1000) {
  await page.bringToFront();
  await page.type('#tx-amount', String(amount));
  await page.type('#tx-description', description);
  await page.click('button[type=submit]');
  // Guardado (con o sin conexión) = el formulario se limpia. Intervalo fijo: funciona en segundo plano.
  await page.waitForFunction(() => document.querySelector('#tx-description').value === '', {
    timeout: 8000,
    polling: 200,
  });
}

const pendingCount = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const req = indexedDB.open('fintrack');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('pending')) return res(0);
          const c = db.transaction('pending').objectStore('pending').count();
          c.onsuccess = () => res(c.result);
        };
      }),
  );

const waitPending = (page, n, timeout = 10000) =>
  page.waitForFunction(
    (n) =>
      new Promise((res) => {
        const req = indexedDB.open('fintrack');
        req.onsuccess = () => {
          const c = req.result.transaction('pending').objectStore('pending').count();
          c.onsuccess = () => res(c.result === n);
        };
      }),
    { timeout, polling: 300 },
    n,
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function caso(id, name, fn) {
  const context = await browser.createBrowserContext();
  try {
    const detail = await fn(context);
    results.push({ id, name, ok: true, detail });
    console.log(`✓ ${id} ${name}\n   ${detail}`);
  } catch (err) {
    results.push({ id, name, ok: false, detail: err.message });
    console.log(`✗ ${id} ${name}\n   ${err.message}`);
  } finally {
    await context.close();
  }
}

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------------------------

await caso('C1', 'Registrar sin conexión y sincronizar al volver', async (ctx) => {
  const s = await newUser('c1');
  const page = await openApp(ctx, s);
  await page.setOfflineMode(true);
  await register(page, 'C1 taxi');
  check((await pendingCount(page)) === 1, 'no quedó en la cola');
  check((await serverRows(s)).length === 0, 'llegó al servidor estando offline');
  await page.setOfflineMode(false);
  await waitPending(page, 0);
  const rows = await serverRows(s);
  check(rows.length === 1, `en el servidor hay ${rows.length}`);
  return 'cola 1 → 0; servidor 0 → 1';
});

await caso('C2', 'Recargar y cerrar la pestaña sin conexión no pierde pendientes', async (ctx) => {
  const s = await newUser('c2');
  let page = await openApp(ctx, s);
  await page.setOfflineMode(true);
  await register(page, 'C2 almuerzo');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Pendientes de sincronizar'));
  await page.close();
  page = await ctx.newPage();
  await page.setOfflineMode(true);
  await page.goto(`${APP}/app/transacciones`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('C2 almuerzo'), { timeout: 8000 });
  await page.setOfflineMode(false);
  await waitPending(page, 0);
  check((await serverRows(s)).length === 1, 'no llegó al servidor');
  return 'sigue tras recargar y tras cerrar/abrir la pestaña offline; luego se sincroniza 1 vez';
});

await caso('C3', 'Varios movimientos offline se envían en un solo lote', async (ctx) => {
  const s = await newUser('c3');
  const page = await openApp(ctx, s);
  const batches = [];
  page.on('request', (r) => r.url().endsWith('/sync/batch') && r.method() === 'POST' && batches.push(r));
  await page.setOfflineMode(true);
  for (const d of ['C3 uno', 'C3 dos', 'C3 tres']) await register(page, d);
  check((await pendingCount(page)) === 3, 'no quedaron 3 en la cola');
  await page.setOfflineMode(false);
  await waitPending(page, 0);
  const rows = await serverRows(s);
  check(rows.length === 3, `en el servidor hay ${rows.length}`);
  const ops = JSON.parse(batches[0].postData()).operations.length;
  return `${batches.length} petición(es) a /sync/batch; la primera con ${ops} operaciones; servidor: 3`;
});

await caso('C4', 'Conexión que va y viene varias veces', async (ctx) => {
  const s = await newUser('c4');
  const page = await openApp(ctx, s);
  for (const d of ['C4 a', 'C4 b', 'C4 c']) {
    await page.setOfflineMode(true);
    await register(page, d);
    await page.setOfflineMode(false);
    await sleep(150); // corte corto: vuelve la red y se va antes de que termine la sincronización
  }
  await waitPending(page, 0, 15000);
  const rows = await serverRows(s);
  check(rows.length === 3, `en el servidor hay ${rows.length} (esperado 3, sin duplicados)`);
  return '3 ciclos offline/online seguidos → 3 movimientos, sin duplicados';
});

await caso('C5', 'Se pierde la respuesta de /sync/batch: el reenvío no duplica', async (ctx) => {
  const s = await newUser('c5');
  const page = await openApp(ctx, s);
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  let dropped = false;
  page.on('request', async (req) => {
    if (!dropped && req.url().endsWith('/sync/batch') && req.method() === 'POST') {
      dropped = true;
      // El servidor recibe y aplica el lote, pero la respuesta nunca llega al navegador.
      await fetch(req.url(), { method: 'POST', headers: req.headers(), body: req.postData() });
      return req.abort('failed');
    }
    req.continue();
  });
  await page.setOfflineMode(true);
  await register(page, 'C5 cine');
  await page.setOfflineMode(false);
  await sleep(1500);
  check(dropped, 'no se interceptó el envío');
  check((await serverRows(s)).length === 1, 'el servidor no aplicó el primer lote');
  check((await pendingCount(page)) === 1, 'la cola debía conservar el pendiente');
  // Nuevo intento (como al reabrir la app).
  await page.reload({ waitUntil: 'networkidle0' });
  await waitPending(page, 0);
  const rows = await serverRows(s);
  check(rows.length === 1, `en el servidor hay ${rows.length}: se duplicó`);
  return 'el servidor aplicó el lote, la respuesta se perdió, se reenvió con el mismo localId → 1 movimiento';
});

await caso('C6', 'Servidor caído al reconectar: ¿reintenta solo? (bug 86e3u5wnm)', async (ctx) => {
  const s = await newUser('c6');
  const page = await openApp(ctx, s);
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  let serverDown = true;
  page.on('request', (req) =>
    serverDown && req.url().startsWith(API) ? req.abort('connectionrefused') : req.continue(),
  );
  await page.setOfflineMode(true);
  await register(page, 'C6 farmacia');
  await page.setOfflineMode(false); // vuelve la red, pero el servidor no responde
  await sleep(1500);
  serverDown = false; // el servidor se recupera
  await sleep(8000);
  const left = await pendingCount(page);
  const rows = await serverRows(s);
  check(left === 0 && rows.length === 1, `tras recuperarse el servidor: cola ${left}, servidor ${rows.length} (no reintentó)`);
  return 'reintentó solo';
});

await caso('C7', 'Se pierde la respuesta de POST /transactions con conexión (bug 86e3u5wnc)', async (ctx) => {
  const s = await newUser('c7');
  const page = await openApp(ctx, s);
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  let dropped = false;
  page.on('request', async (req) => {
    if (!dropped && req.url() === `${API}/transactions` && req.method() === 'POST') {
      dropped = true;
      await fetch(req.url(), { method: 'POST', headers: req.headers(), body: req.postData() });
      return req.abort('failed');
    }
    req.continue();
  });
  await register(page, 'C7 mercado');
  await sleep(300);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitPending(page, 0);
  const rows = await serverRows(s, 'C7');
  check(rows.length === 1, `en el servidor hay ${rows.length} "C7 mercado": se duplicó`);
  return 'no se duplicó';
});

await caso('C8', 'Dos dispositivos: uno offline y otro en línea', async () => {
  const s = await newUser('c8');
  const phone = await browser.createBrowserContext();
  const laptop = await browser.createBrowserContext();
  try {
    const a = await openApp(phone, s);
    const b = await openApp(laptop, s);
    await a.setOfflineMode(true);
    await register(a, 'C8 desde el celular');
    await register(b, 'C8 desde el computador');
    check((await serverRows(s)).length === 1, 'solo debía estar el del computador');
    await a.setOfflineMode(false);
    await waitPending(a, 0);
    const rows = await serverRows(s);
    check(rows.length === 2, `en el servidor hay ${rows.length}`);
    await b.reload({ waitUntil: 'networkidle0' });
    const seen = await b.evaluate(() => document.body.innerText.includes('C8 desde el celular'));
    check(seen, 'el computador no ve el movimiento del celular tras recargar');
    return 'servidor: 2; el computador ve el del celular al recargar';
  } finally {
    await phone.close();
    await laptop.close();
  }
});

await caso('C9', 'Dos pestañas del mismo dispositivo al reconectar', async (ctx) => {
  const s = await newUser('c9');
  const t1 = await openApp(ctx, s);
  const t2 = await openApp(ctx, s);
  await t1.setOfflineMode(true);
  await t2.setOfflineMode(true);
  await register(t1, 'C9 gimnasio');
  await Promise.all([t1.setOfflineMode(false), t2.setOfflineMode(false)]);
  await waitPending(t1, 0);
  await sleep(1000);
  const rows = await serverRows(s);
  check(rows.length === 1, `en el servidor hay ${rows.length}: se duplicó`);
  return 'ambas pestañas intentan enviar; el servidor guarda 1 (lo frena el localId)';
});

await caso('C10', 'Otra cuenta en el mismo dispositivo no envía pendientes ajenos', async (ctx) => {
  const ana = await newUser('c10ana');
  const beto = await newUser('c10beto');
  const page = await openApp(ctx, ana);
  await page.setOfflineMode(true);
  await register(page, 'C10 de Ana');
  // Ana cierra sesión sin conexión y entra Beto.
  await page.evaluate((s) => localStorage.setItem('fintrack.session', JSON.stringify(s)), beto);
  await page.setOfflineMode(false);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  check((await serverRows(beto)).length === 0, 'el pendiente de Ana se guardó en la cuenta de Beto');
  check((await serverRows(ana)).length === 0, 'se envió con la cuenta equivocada');
  // Vuelve Ana: su pendiente se envía a su cuenta.
  await page.evaluate((s) => localStorage.setItem('fintrack.session', JSON.stringify(s)), ana);
  await page.reload({ waitUntil: 'networkidle0' });
  await waitPending(page, 0);
  check((await serverRows(ana)).length === 1, 'no llegó a la cuenta de Ana');
  return 'con Beto no se envía; al volver Ana llega a su cuenta';
});

await caso('C11', 'Operación rechazada (422) en la cola (bug 86e3u5wnf)', async (ctx) => {
  const s = await newUser('c11');
  const page = await openApp(ctx, s);
  await page.setOfflineMode(true);
  await register(page, 'C11 válido');
  // Simula un pendiente con una categoría que el servidor rechaza (catálogo desactualizado).
  await page.evaluate(
    (userId) =>
      new Promise((res) => {
        const req = indexedDB.open('fintrack');
        req.onsuccess = () => {
          const tx = req.result.transaction('pending', 'readwrite');
          tx.objectStore('pending').add({
            localId: crypto.randomUUID(),
            userId,
            op: 'create',
            transaction: { amount: 500, description: 'C11 categoría vieja', type: 'gasto', date: '2026-10-20', category: 'categoria_que_no_existe' },
            createdAt: new Date().toISOString(),
          });
          tx.oncomplete = res;
        };
      }),
    s.user.id,
  );
  await page.setOfflineMode(false);
  await waitPending(page, 0);
  const rows = await serverRows(s);
  const lost = !rows.some((r) => r.description === 'C11 categoría vieja');
  check(rows.length === 2, `el válido llegó, pero "C11 categoría vieja" ${lost ? 'se borró de la cola y se perdió' : 'no llegó'} (servidor: ${rows.length})`);
  return 'llegaron los dos';
});

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} casos pasaron`);
process.exitCode = passed === results.length ? 0 : 1;
