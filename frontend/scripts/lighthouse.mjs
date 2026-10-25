/**
 * Auditoría de Lighthouse (rendimiento, accesibilidad, buenas prácticas y SEO) sobre las
 * páginas públicas y las de la app con sesión. Resultados y paso a paso: `docs/lighthouse.md`.
 *
 * Requiere:
 *   - Backend y base de datos: `docker compose up -d` (API en :3000).
 *   - Frontend compilado: `npm run build && npx vite preview --port 5173`.
 *   - Google Chrome instalado (puppeteer-core no descarga navegador).
 *
 * Uso (desde `frontend/`):
 *   npm run lighthouse
 *   PAGES=/app,/login npm run lighthouse     # solo algunas páginas
 *   APP_URL=https://fintrack-seven-delta.vercel.app API_URL=https://fintrack-api-2z1p.onrender.com npm run lighthouse
 *
 * Usa el perfil móvil de Lighthouse (CPU 4x más lenta y red 4G simulada), el más exigente.
 * Crea un usuario de prueba (`lighthouse.*@fintrack.dev`) con algunos movimientos para que el
 * dashboard no salga vacío. Guarda los reportes HTML en `lighthouse-reports/`.
 *
 * Código de salida: 0 = todas las categorías >= 90, 1 = alguna por debajo.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

/** Ruta de Chrome por sistema operativo; `CHROME_PATH` la reemplaza. */
const DEFAULT_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux: '/usr/bin/google-chrome',
}[process.platform];

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const API = `${(process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/v1`;
const MIN_SCORE = 90;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const ONLY = process.env.PAGES?.split(',').map((p) => p.trim());
const pick = (pages) => (ONLY ? pages.filter((p) => ONLY.includes(p)) : pages);
const PUBLIC_PAGES = pick(['/', '/login', '/registro']);
const APP_PAGES = pick(['/app', '/app/transacciones', '/app/presupuestos']);
const OUT_DIR = 'lighthouse-reports';

const post = (path, body, token) =>
  fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const json = await r.json();
    // Si falla el registro o un movimiento, se auditaría un dashboard vacío sin avisar.
    if (!r.ok) throw new Error(`${path} respondió ${r.status}: ${JSON.stringify(json)}`);
    return json;
  });

/** Usuario nuevo con un ingreso y dos gastos de este mes. */
async function newUser() {
  const session = await post('/auth/register', {
    email: `lighthouse.${Date.now()}@fintrack.dev`,
    password: 'prueba1234',
  });
  const date = new Date().toISOString().slice(0, 10);
  for (const [type, amount, description] of [
    ['ingreso', 2500000, 'Salario'],
    ['gasto', 85000, 'Mercado'],
    ['gasto', 32000, 'Transporte'],
  ]) {
    await post('/transactions', { type, amount, description, date }, session.accessToken);
  }
  return session;
}

/**
 * Audita `path`. Con sesión, Lighthouse no puede borrar el almacenamiento (perdería el token),
 * así que antes se borran a mano la caché HTTP, el service worker y la copia offline: la carga
 * sigue siendo "en frío", como la de un usuario que abre la app por primera vez.
 */
async function audit(browser, page, path, withSession) {
  if (withSession) {
    const cdp = await page.createCDPSession();
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Storage.clearDataForOrigin', {
      origin: new URL(APP).origin,
      storageTypes: 'cache_storage,service_workers,indexeddb',
    });
    await cdp.detach();
  }
  const port = Number(new URL(browser.wsEndpoint()).port);
  const { lhr, report } = await lighthouse(APP + path, {
    port,
    output: 'html',
    logLevel: 'error',
    onlyCategories: CATEGORIES,
    disableStorageReset: withSession,
  });
  const name = path === '/' ? 'inicio' : path.slice(1).replaceAll('/', '-');
  await writeFile(`${OUT_DIR}/${name}.html`, report);
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(lhr.categories[c].score * 100)]));
  return { page: path, ...scores };
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || DEFAULT_CHROME,
  headless: true,
});
const results = [];
try {
  await mkdir(OUT_DIR, { recursive: true });
  const page = await browser.newPage();
  for (const path of PUBLIC_PAGES) results.push(await audit(browser, page, path, false));

  if (APP_PAGES.length) {
    const session = await newUser();
    await page.goto(`${APP}/login`);
    await page.evaluate((s) => localStorage.setItem('fintrack.session', JSON.stringify(s)), session);
    for (const path of APP_PAGES) results.push(await audit(browser, page, path, true));
  }
} finally {
  await browser.close();
}

console.table(results);
const failing = results.filter((r) => CATEGORIES.some((c) => r[c] < MIN_SCORE));
console.log(failing.length ? `\n${failing.length} página(s) por debajo de ${MIN_SCORE}.` : `\nTodas >= ${MIN_SCORE}.`);
console.log(`Reportes en ${OUT_DIR}/`);
process.exit(failing.length ? 1 : 0);
