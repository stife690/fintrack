/**
 * Pruebas offline de punta a punta sobre todas las funcionalidades (Sprint 3, Integrante 3).
 * Complementa `sync-cases.mjs` (la cola y la sincronización, FT-0009): aquí se recorre la app
 * entera sin conexión. Casos y resultados en `docs/pruebas-offline.md`.
 *
 * Requiere lo mismo que `npm run test:sync`: backend en :3000, frontend compilado servido en
 * :5173 (`npm run build && npx vite preview --port 5173`) y Google Chrome.
 *
 * Uso (desde `frontend/`):
 *   npm run test:offline
 *   CASES=O1,O9 npm run test:offline
 *
 * Modo avión: al cargar o recargar una página con `page.setOfflineMode(true)`, Chrome deja
 * `navigator.onLine` en `true` (en un celular real queda en `false`). `airplane()` lo fija en
 * `false` desde antes de que cargue la app, como pasa en el dispositivo.
 *
 * Código de salida: 0 = todos los casos pasan, 1 = alguno falló.
 */
import puppeteer from 'puppeteer-core';

const DEFAULT_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux: '/usr/bin/google-chrome',
}[process.platform];

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const API = `${(process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/v1`;
const PASSWORD = 'prueba1234';
const ROUTES = ['/app', '/app/transacciones', '/app/presupuestos', '/app/insights', '/app/transacciones/exportar', '/app/cuenta'];
const results = [];

const api = (path, { method = 'GET', body, token } = {}) =>
  fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  }).then((r) => r.json());

async function newUser(tag) {
  const email = `offline.${tag}.${Date.now()}@fintrack.dev`;
  const session = await api('/auth/register', { method: 'POST', body: { email, password: PASSWORD } });
  if (!session.accessToken) throw new Error(`registro falló: ${JSON.stringify(session)}`);
  return { ...session, email };
}

const serverRows = async (s) => (await api('/transactions?pageSize=100', { token: s.accessToken })).data;

const browser = await puppeteer.launch({
  protocolTimeout: 60000,
  executablePath: process.env.CHROME_PATH || DEFAULT_CHROME,
  headless: true,
});

/** Abre la app con sesión y espera a que el service worker controle la página (ya hay caché). */
async function openApp(context, session, path = '/app') {
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message));
  // `navigator.onLine` sigue a la bandera de sessionStorage (ver `airplane`); sin ella, al real.
  await page.evaluateOnNewDocument(() => {
    const real = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine').get;
    Object.defineProperty(Navigator.prototype, 'onLine', {
      get() {
        return sessionStorage.getItem('e2e-airplane') === '1' ? false : real.call(this);
      },
    });
  });
  await page.goto(`${APP}/login`);
  if (session) await page.evaluate((s) => localStorage.setItem('fintrack.session', JSON.stringify(s)), session);
  await page.goto(APP + path, { waitUntil: 'networkidle0' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle0' });
  return page;
}

/** Activa o quita el modo avión: sin red y con `navigator.onLine` como en el celular. */
async function airplane(page, on) {
  await page.setOfflineMode(on);
  await page.evaluate((on) => {
    if (on) sessionStorage.setItem('e2e-airplane', '1');
    else sessionStorage.removeItem('e2e-airplane');
    window.dispatchEvent(new Event(on ? 'offline' : 'online'));
  }, on);
}

const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, t, timeout = 8000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 200 }, t);

/** Navega dentro de la app con un enlace del menú (sin recargar), como lo haría el usuario. */
async function navigate(page, path) {
  await page.evaluate((path) => {
    const link = [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === path);
    if (!link) throw new Error(`no hay enlace a ${path}`);
    link.click();
  }, path);
  await page.waitForFunction((path) => location.pathname === path, {}, path);
  await new Promise((r) => setTimeout(r, 800));
}

async function register(page, description, { amount = 1000, category } = {}) {
  await page.type('#tx-amount', String(amount));
  await page.type('#tx-description', description);
  if (category) {
    // Las categorías son radios dentro de <label> (CategoryPicker).
    await page.evaluate((c) => [...document.querySelectorAll('form label')].find((l) => l.textContent.trim() === c).click(), category);
  }
  await page.click('form button[type=submit]');
  await page.waitForFunction(() => document.querySelector('#tx-description').value === '', { timeout: 8000, polling: 200 });
}

const pendingCount = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const req = indexedDB.open('fintrack');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('pending')) return db.close(), res(0);
          const c = db.transaction('pending').objectStore('pending').count();
          c.onsuccess = () => {
            db.close(); // se consulta cada 300 ms: sin cerrar se acumulan conexiones
            res(c.result);
          };
        };
      }),
  );

async function waitPending(page, n, timeout = 15000) {
  const end = Date.now() + timeout;
  while ((await pendingCount(page)) !== n) {
    if (Date.now() > end) throw new Error(`la cola no llegó a ${n} (tiene ${await pendingCount(page)})`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Botón por su texto (empieza con `label`); `null` si no existe. */
const buttonState = (page, label) =>
  page.evaluate((label) => {
    const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(label));
    return b ? { disabled: b.disabled } : null;
  }, label);

const only = process.env.CASES?.split(',').map((c) => c.trim());

async function caso(id, name, fn) {
  if (only && !only.includes(id)) return;
  const context = await browser.createBrowserContext();
  try {
    const detail = await fn(context);
    results.push({ id, name, ok: true, detail });
    console.log(`✓ ${id} ${name}\n   ${detail}`);
  } catch (err) {
    results.push({ id, name, ok: false, detail: err.message });
    console.log(`✗ ${id} ${name}\n   ${err.message}`);
    if (process.env.STACK) console.log(err.stack);
  } finally {
    await context.close();
  }
}

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

const crashed = (t) => t.includes('Algo salió mal');

// ---------------------------------------------------------------------------------------------

await caso('O1', 'Abrir la app en modo avión: carga cada pantalla desde el dispositivo', async (ctx) => {
  const s = await newUser('o1');
  const page = await openApp(ctx, s);
  await airplane(page, true);
  for (const path of ROUTES) {
    await page.goto(APP + path, { waitUntil: 'domcontentloaded' });
    await waitText(page, 'Sin conexión.');
    const t = await text(page);
    check(!crashed(t), `${path}: pantalla de error`);
    check(new URL(page.url()).pathname === path, `${path}: terminó en ${page.url()}`);
    // Sin red no se sabe si hay presupuestos: no debe decir que no hay.
    if (path === '/app/presupuestos') {
      await waitText(page, 'No pudimos conectar');
      check(!(await text(page)).includes('No tienes presupuestos'), 'presupuestos: dice "No tienes presupuestos" sin poder saberlo');
    }
  }
  return `las ${ROUTES.length} pantallas cargan sin red, con el aviso "Sin conexión" y sin perder la sesión`;
});

await caso('O2', 'Navegar por el menú sin conexión', async (ctx) => {
  const s = await newUser('o2');
  const page = await openApp(ctx, s);
  await airplane(page, true);
  for (const path of ['/app/transacciones', '/app/presupuestos', '/app/insights', '/app/cuenta', '/app']) {
    await navigate(page, path);
    check(!crashed(await text(page)), `${path}: pantalla de error`);
  }
  await navigate(page, '/app/transacciones');
  await navigate(page, '/app/transacciones/exportar');
  check(!crashed(await text(page)), 'exportar: pantalla de error');
  return 'Inicio, Movimientos, Presupuestos, Insights, Exportar y Cuenta abren sin red (código precargado)';
});

await caso('O3', 'Gasto sin categoría registrado sin conexión: se clasifica (o queda "Sin clasificar") al sincronizar', async (ctx) => {
  const s = await newUser('o3');
  const page = await openApp(ctx, s, '/app/transacciones');
  await airplane(page, true);
  await register(page, 'O3 almuerzo corrientazo');
  check((await pendingCount(page)) === 1, 'no quedó en la cola');
  await airplane(page, false);
  await waitPending(page, 0);
  const [row] = await serverRows(s);
  // Con IA disponible llega categorizado (source ia); sin clave o con la IA caída, `sin_clasificar` (REQ-011).
  check(row && (row.category ? row.source === 'ia' : row.source === 'sin_clasificar'), `llegó así: ${JSON.stringify(row)}`);
  return row.category ? `la IA lo clasificó como "${row.category}"` : 'sin IA disponible quedó "Sin clasificar", como pide REQ-011';
});

await caso('O4', 'Gasto sin conexión que pasa el presupuesto: la alerta aparece al sincronizar', async (ctx) => {
  const s = await newUser('o4');
  const month = new Date().toISOString().slice(0, 7);
  await api('/budgets', { method: 'POST', token: s.accessToken, body: { category: 'alimentacion', month, amount: 50000 } });
  const page = await openApp(ctx, s, '/app/transacciones');
  await airplane(page, true);
  await register(page, 'O4 mercado', { amount: 60000, category: 'Alimentación' });
  await airplane(page, false);
  await waitPending(page, 0);
  const budgets = await api(`/budgets?month=${month}`, { token: s.accessToken });
  const b = (budgets.data ?? budgets)[0];
  check(b.percentage >= 100, `el presupuesto quedó en ${b.percentage} %`);
  await navigate(page, '/app/presupuestos');
  await waitText(page, '120 %');
  return `servidor: ${b.percentage} % (${b.alert?.level}); la pantalla de presupuestos lo muestra`;
});

await caso('O5', 'Presupuestos sin conexión: no deja crear, editar ni borrar', async (ctx) => {
  const s = await newUser('o5');
  const month = new Date().toISOString().slice(0, 7);
  await api('/budgets', { method: 'POST', token: s.accessToken, body: { category: 'transporte', month, amount: 80000 } });
  const page = await openApp(ctx, s, '/app/presupuestos');
  await waitText(page, 'Transporte');
  await airplane(page, true);
  // React vuelve a pintar después del evento `offline`: se espera a que el botón se desactive.
  await page
    .waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Crear presupuesto'))?.disabled, { timeout: 5000 })
    .catch(() => {});
  const create = await buttonState(page, 'Crear presupuesto');
  check(create?.disabled, 'el botón "Crear presupuesto" sigue activo');
  const edit = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => /Editar|Eliminar/.test(b.getAttribute('aria-label') ?? b.textContent)).map((b) => b.disabled),
  );
  check(edit.length && edit.every(Boolean), `editar/eliminar activos: ${JSON.stringify(edit)}`);
  return `crear y ${edit.length} botones de editar/eliminar quedan desactivados; el presupuesto ya cargado sigue visible`;
});

await caso('O6', 'Insights sin conexión: explica que necesita internet', async (ctx) => {
  const s = await newUser('o6');
  const page = await openApp(ctx, s);
  await airplane(page, true);
  await page.goto(`${APP}/app/insights`, { waitUntil: 'domcontentloaded' });
  await waitText(page, 'Los insights necesitan internet');
  return 'muestra "Sin conexión. Los insights necesitan internet…" con Reintentar';
});

await caso('O7', 'Exportar sin conexión: el botón se desactiva y avisa por qué', async (ctx) => {
  const s = await newUser('o7');
  const page = await openApp(ctx, s, '/app/transacciones/exportar');
  await airplane(page, true);
  await waitText(page, 'Necesitas conexión para exportar');
  check((await buttonState(page, 'Descargar'))?.disabled, 'el botón de descarga sigue activo');
  await airplane(page, false);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Descargar'))?.disabled === false);
  return 'sin red: botón desactivado y aviso; al volver la red se reactiva solo';
});

await caso('O8', 'Cuenta sin conexión: no deja editar el perfil', async (ctx) => {
  const s = await newUser('o8');
  const page = await openApp(ctx, s, '/app/cuenta');
  await airplane(page, true);
  check((await buttonState(page, 'Agregar nombre'))?.disabled, '"Agregar nombre" sigue activo');
  check(!crashed(await text(page)), 'pantalla de error');
  return '"Agregar nombre" desactivado; el tema (local) sigue disponible';
});

await caso('O9', 'Sesión vencida mientras no hay red: no saca al usuario y sincroniza al volver', async (ctx) => {
  const s = await newUser('o9');
  const page = await openApp(ctx, s, '/app/transacciones');
  // El access token vence (15 min); el refresh token sigue vigente.
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('fintrack.session'));
    localStorage.setItem('fintrack.session', JSON.stringify({ ...session, accessToken: 'vencido' }));
  });
  await airplane(page, true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitText(page, 'Sin conexión');
  check(new URL(page.url()).pathname === '/app/transacciones', `terminó en ${page.url()}`);
  await register(page, 'O9 bus');
  await airplane(page, false);
  await waitPending(page, 0);
  check((await serverRows(s)).length === 1, 'no llegó al servidor');
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('fintrack.session')).accessToken);
  check(token !== 'vencido', 'no renovó el token');
  return 'sigue en la app sin red; al volver renueva la sesión y envía el pendiente';
});

await caso('O10', 'Iniciar sesión sin conexión: avisa sin romperse', async (ctx) => {
  const page = await openApp(ctx, null, '/login');
  await airplane(page, true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=email]');
  await page.type('input[type=email]', 'alguien@fintrack.dev');
  await page.type('input[type=password]', PASSWORD);
  await page.click('form button[type=submit]');
  await waitText(page, 'No pudimos conectar con el servidor');
  check(new URL(page.url()).pathname === '/login', `terminó en ${page.url()}`);
  return 'la pantalla de login abre sin red y muestra "No pudimos conectar con el servidor"';
});

await caso('O11', 'Inicio sin conexión: cuenta los pendientes y no se rompe', async (ctx) => {
  const s = await newUser('o11');
  const page = await openApp(ctx, s, '/app/transacciones');
  await airplane(page, true);
  await register(page, 'O11 tinto');
  await navigate(page, '/app');
  await waitText(page, '1 pendiente');
  const t = await text(page);
  check(!crashed(t), 'pantalla de error');
  check(!t.includes('Te damos la bienvenida'), 'muestra el estado vacío aunque hay un pendiente');
  const errors = (t.match(/No pudimos/g) ?? []).length;
  return `muestra el pendiente; ${errors} avisos "No pudimos…" en balance, últimos movimientos y presupuestos`;
});

await caso('O12', 'Conexión intermitente navegando por toda la app', async (ctx) => {
  const s = await newUser('o12');
  const page = await openApp(ctx, s, '/app/transacciones');
  const paths = ['/app/presupuestos', '/app/insights', '/app/cuenta', '/app', '/app/transacciones'];
  for (let i = 0; i < 3; i++) {
    await airplane(page, true);
    await register(page, `O12 gasto ${i}`);
    for (const path of paths) {
      await airplane(page, path.length % 2 === 0);
      await navigate(page, path);
      check(!crashed(await text(page)), `${path}: pantalla de error`);
    }
  }
  await airplane(page, false);
  await waitPending(page, 0);
  const rows = await serverRows(s);
  check(rows.length === 3, `en el servidor hay ${rows.length}`);
  return '3 vueltas con la red yendo y viniendo en cada pantalla: sin errores, 3 movimientos sin duplicar';
});

await caso('O13', 'Cerrar sesión sin conexión con pendientes: no se pierden', async (ctx) => {
  const s = await newUser('o13');
  const page = await openApp(ctx, s, '/app/transacciones');
  await airplane(page, true);
  await register(page, 'O13 taxi');
  await navigate(page, '/app/cuenta');
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Cerrar sesión').pop().click());
  await page.waitForFunction(() => !localStorage.getItem('fintrack.session'), { timeout: 8000 });
  await airplane(page, false);
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[type=email]', s.email);
  await page.type('input[type=password]', PASSWORD);
  await page.click('form button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 10000 });
  await waitPending(page, 0);
  check((await serverRows(s)).length === 1, 'el pendiente no llegó');
  return 'cierra la sesión sin red; al volver a entrar con red, el pendiente se envía';
});

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} casos pasaron`);
process.exitCode = passed === results.length ? 0 : 1;
