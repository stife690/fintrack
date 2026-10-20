import { http, HttpResponse, delay } from 'msw';
import { API_V1 } from '@/lib/api';

/**
 * Handlers de MSW que simulan auth, categorías y transacciones mientras se desarrolla sin backend.
 * Siguen `docs/api/openapi.yaml` (v2.0.1): rutas bajo `/api/v1`, errores con la forma
 * `{ error: { code, message, details? } }` y `AuthResponse` con tokens.
 * Los usuarios y sesiones viven en memoria: se reinician al recargar la página.
 */

/** @type {Map<string, { id: string, email: string, password: string, timezone: string }>} */
const users = new Map();
/** access token → email */
const accessTokens = new Map();
/** refresh token → email */
const refreshTokens = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Llave pública VAPID de ejemplo (válida, solo para desarrollo): permite suscribirse sin backend. */
const MOCK_VAPID_PUBLIC_KEY =
  'BKQMg0AmJJ34cFCv2R9ZhYsC5nfn4yDHX59UkDTz9Oxt7hVPlf6syvjSKfGKnk3TbL73wdayjvf5NNN5fsevPJU';
/** endpoint de suscripción push → id del usuario */
const pushEndpoints = new Map();
/** id del usuario → configuración del recordatorio diario */
const reminders = new Map();

addUser('demo@fintrack.com', 'demo1234');

function addUser(email, password) {
  const user = { id: crypto.randomUUID(), email, password, timezone: 'America/Bogota' };
  users.set(email, user);
  return user;
}

/** Respuesta de error con el esquema `Error` del contrato. */
function error(status, code, message, details) {
  return HttpResponse.json({ error: { code, message, ...(details && { details }) } }, { status });
}

/** Emite un par de tokens nuevo y devuelve un `AuthResponse`. */
function issueSession(user) {
  const accessToken = `mock-access.${crypto.randomUUID()}`;
  const refreshToken = `mock-refresh.${crypto.randomUUID()}`;
  accessTokens.set(accessToken, user.email);
  refreshTokens.set(refreshToken, user.email);
  return { user: { id: user.id, email: user.email }, accessToken, refreshToken };
}

/** Lee el body JSON; `null` si está malformado (→ 400). */
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Valida `Credentials`: 400 si los tipos no cuadran, 422 si incumple reglas. */
function checkCredentials(body) {
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const details = [];
  if (!EMAIL_RE.test(body.email.trim())) details.push({ field: 'email', problem: 'Debe ser un correo válido' });
  if (body.password.length < 8) details.push({ field: 'password', problem: 'Debe tener al menos 8 caracteres' });
  return details.length ? error(422, 'VALIDATION_ERROR', 'Datos inválidos', details) : null;
}

/** Usuario dueño del Bearer token, o `null`. */
function authUser(request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const email = token && accessTokens.get(token);
  return email ? users.get(email) : null;
}

/** Catálogo cerrado de categorías (mismas claves que `db/init/02_seed_categorias.sql`). */
const CATALOG = [
  ['alimentacion', 'Alimentación', 'gasto'],
  ['transporte', 'Transporte', 'gasto'],
  ['vivienda', 'Vivienda', 'gasto'],
  ['servicios_publicos', 'Servicios públicos', 'gasto'],
  ['salud', 'Salud', 'gasto'],
  ['educacion', 'Educación', 'gasto'],
  ['entretenimiento', 'Entretenimiento', 'gasto'],
  ['ropa_accesorios', 'Ropa y accesorios', 'gasto'],
  ['tecnologia', 'Tecnología', 'gasto'],
  ['ahorro_inversion', 'Ahorro/Inversión', 'gasto'],
  ['otros', 'Otros', 'gasto'],
  ['salario', 'Salario', 'ingreso'],
  ['freelance', 'Freelance', 'ingreso'],
  ['inversion_rendimientos', 'Inversión y rendimientos', 'ingreso'],
  ['otros_ingresos', 'Otros ingresos', 'ingreso'],
].map(([key, name, type]) => ({ key, name, type }));

/** Palabras que el mock usa en lugar de la IA para sugerir una categoría. */
const KEYWORDS = {
  alimentacion: /almuerzo|cena|desayuno|restaurante|mercado|comida|caf[eé]|super/i,
  transporte: /taxi|uber|bus|gasolina|metro|transporte|peaje/i,
  vivienda: /arriendo|alquiler|hipoteca|vivienda/i,
  servicios_publicos: /luz|agua|internet|gas natural|energ[ií]a|tel[eé]fono/i,
  salud: /m[eé]dico|farmacia|salud|droguer[ií]a/i,
  educacion: /curso|matr[ií]cula|universidad|libro/i,
  entretenimiento: /cine|netflix|spotify|concierto|juego/i,
  salario: /n[oó]mina|salario|sueldo/i,
  freelance: /freelance|proyecto|honorarios/i,
};

/** user id → transacciones (en memoria, como los usuarios). */
const transactions = new Map();

/** Sugerencia del mock: la primera categoría del tipo cuyo patrón coincide, o `null`. */
function mockSuggest(description, type) {
  const match = CATALOG.find((c) => c.type === type && KEYWORDS[c.key]?.test(description));
  return match ? match.key : null;
}

/** Valida el cuerpo de crear/editar como lo hace la API (422 con `details`). */
function checkTransaction(body, { partial }) {
  const details = [];
  const has = (f) => body && f in body;
  if ((!partial || has('amount')) && !(typeof body?.amount === 'number' && body.amount > 0)) {
    details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
  }
  if ((!partial || has('description')) && !(typeof body?.description === 'string' && body.description.trim())) {
    details.push({ field: 'description', problem: 'Es obligatoria' });
  }
  if ((!partial || has('type')) && !['ingreso', 'gasto'].includes(body?.type)) {
    details.push({ field: 'type', problem: 'Debe ser "ingreso" o "gasto"' });
  }
  if ((!partial || has('date')) && !/^\d{4}-\d{2}-\d{2}$/.test(body?.date ?? '')) {
    details.push({ field: 'date', problem: 'Debe ser una fecha válida AAAA-MM-DD' });
  }
  return details.length ? error(422, 'VALIDATION_ERROR', 'Datos inválidos', details) : null;
}

/** Comprueba que la categoría exista y sea del tipo indicado. */
function checkCategory(key, type) {
  const found = CATALOG.find((c) => c.key === key);
  if (found && found.type === type) return null;
  return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [
    { field: 'category', problem: `No es una categoría de ${type} del catálogo` },
  ]);
}

/** Decide categoría y origen: la del usuario o la que "sugiere la IA". */
function resolve(category, description, type) {
  if (category) return { category, source: 'manual' };
  const suggested = mockSuggest(description, type);
  return suggested
    ? { category: suggested, source: 'ia' }
    : { category: null, source: 'sin_clasificar' };
}

/**
 * Alerta de presupuesto simulada para probar la interfaz sin backend: un gasto desde
 * $500.000 avisa al 80 % y desde $1.000.000 marca el presupuesto como superado.
 * @param {{ type: string, amount: number }} transaction
 * @returns {{ level: string, percentage: number }|null}
 */
function mockAlert({ type, amount }) {
  if (type !== 'gasto') return null;
  if (amount >= 1_000_000) return { level: 'exceeded_100', percentage: 112.5 };
  if (amount >= 500_000) return { level: 'warning_80', percentage: 85 };
  return { level: 'none', percentage: 20 };
}

export const handlers = [
  http.post(`${API_V1}/auth/register`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    const invalid = checkCredentials(body);
    if (invalid) return invalid;
    const email = body.email.trim().toLowerCase();
    if (users.has(email)) return error(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
    return HttpResponse.json(issueSession(addUser(email, body.password)), { status: 201 });
  }),

  http.post(`${API_V1}/auth/login`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const user = users.get(body.email.trim().toLowerCase());
    if (!user || user.password !== body.password) {
      return error(401, 'UNAUTHORIZED', 'Correo o contraseña incorrectos');
    }
    return HttpResponse.json(issueSession(user));
  }),

  http.post(`${API_V1}/auth/refresh`, async ({ request }) => {
    const body = await readJson(request);
    if (!body || typeof body.refreshToken !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const email = refreshTokens.get(body.refreshToken);
    if (!email) return error(401, 'UNAUTHORIZED', 'Refresh token inválido, vencido o revocado');
    refreshTokens.delete(body.refreshToken); // rotación
    const { accessToken, refreshToken } = issueSession(users.get(email));
    return HttpResponse.json({ accessToken, refreshToken });
  }),

  http.post(`${API_V1}/auth/logout`, async ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    if (body?.refreshToken) refreshTokens.delete(body.refreshToken);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/users/me`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ id: user.id, email: user.email, timezone: user.timezone });
  }),

  http.get(`${API_V1}/categories`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const pick = (type) => CATALOG.filter((c) => c.type === type).map(({ key, name }) => ({ key, name }));
    return HttpResponse.json({ expense: pick('gasto'), income: pick('ingreso') });
  }),

  http.get(`${API_V1}/transactions`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const q = new URL(request.url).searchParams;
    const page = Number(q.get('page') ?? 1);
    const pageSize = Number(q.get('pageSize') ?? 20);
    const rows = (transactions.get(user.id) ?? [])
      .filter((t) => (!q.get('type') || t.type === q.get('type')))
      .filter((t) => (!q.get('category') || t.category === q.get('category')))
      .filter((t) => (!q.get('q') || t.description.toLowerCase().includes(q.get('q').toLowerCase())))
      .filter((t) => (!q.get('from') || t.date >= q.get('from')))
      .filter((t) => (!q.get('to') || t.date <= q.get('to')))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: rows.length,
    });
  }),

  http.post(`${API_V1}/transactions`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    await delay(500);
    const invalid = checkTransaction(body, { partial: false });
    if (invalid) return invalid;
    if (body.category) {
      const wrong = checkCategory(body.category, body.type);
      if (wrong) return wrong;
    }
    const now = new Date().toISOString();
    const transaction = {
      id: crypto.randomUUID(),
      userId: user.id,
      amount: body.amount,
      description: body.description.trim(),
      type: body.type,
      date: body.date,
      ...resolve(body.category, body.description, body.type),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    transactions.set(user.id, [transaction, ...(transactions.get(user.id) ?? [])]);
    return HttpResponse.json({ transaction, alert: mockAlert(transaction) }, { status: 201 });
  }),

  // Versión simplificada de /sync/batch: solo `create`, sin conflictos ni `serverChanges`.
  http.post(`${API_V1}/sync/batch`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    if (!body || !Array.isArray(body.operations)) {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    await delay(500);
    const own = transactions.get(user.id) ?? [];
    const synced = [];
    for (const { op, localId, transaction: input } of body.operations) {
      if (op !== 'create') continue;
      // Reenviar el mismo localId no duplica, como en el servidor real.
      let saved = own.find((t) => t.localId === localId);
      if (!saved) {
        const now = new Date().toISOString();
        saved = {
          id: crypto.randomUUID(),
          localId,
          userId: user.id,
          amount: input.amount,
          description: input.description.trim(),
          type: input.type,
          date: input.date,
          ...resolve(input.category, input.description, input.type),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        own.unshift(saved);
      }
      synced.push({ localId, serverId: saved.id, transaction: saved });
    }
    transactions.set(user.id, own);
    return HttpResponse.json({ synced, conflicts: [], serverChanges: [], syncedAt: new Date().toISOString() });
  }),

  http.get(`${API_V1}/transactions/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const found = (transactions.get(user.id) ?? []).find((t) => t.id === params.id);
    if (!found) return error(404, 'NOT_FOUND', 'Transacción no encontrada');
    return HttpResponse.json(found);
  }),

  http.put(`${API_V1}/transactions/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const current = (transactions.get(user.id) ?? []).find((t) => t.id === params.id);
    if (!current) return error(404, 'NOT_FOUND', 'Transacción no encontrada');
    const body = await readJson(request);
    await delay(400);
    const invalid = checkTransaction(body, { partial: true });
    if (invalid) return invalid;
    const type = body.type ?? current.type;
    const next = { ...current };
    for (const field of ['amount', 'description', 'date']) if (field in body) next[field] = body[field];
    next.type = type;
    if ('category' in body || type !== current.type) {
      const category = 'category' in body ? body.category : null;
      if (category) {
        const wrong = checkCategory(category, type);
        if (wrong) return wrong;
      }
      Object.assign(next, resolve(category, next.description, type));
    }
    next.updatedAt = new Date().toISOString();
    Object.assign(current, next);
    return HttpResponse.json({ transaction: current, alert: mockAlert(current) });
  }),

  http.get(`${API_V1}/insights`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    await delay(800);
    if ((transactions.get(user.id) ?? []).length < 3) {
      return error(
        422,
        'INSUFFICIENT_HISTORY',
        'Aún no hay suficiente historial. Registra movimientos durante al menos un mes para recibir insights.',
      );
    }
    return HttpResponse.json({
      month: new Date().toISOString().slice(0, 7),
      insights: [
        {
          type: 'saving_opportunity',
          title: 'Gastas más en alimentación',
          detail: 'Este mes llevas 18 % más que el anterior. Reducir los domicilios a 2 por semana podría ahorrarte $120.000.',
        },
        {
          type: 'positive_trend',
          title: 'Transporte a la baja',
          detail: 'Gastaste $45.000 menos que el mes pasado en transporte.',
        },
      ],
    });
  }),

  http.get(`${API_V1}/push/vapid-public-key`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ key: MOCK_VAPID_PUBLIC_KEY });
  }),

  http.post(`${API_V1}/push/subscribe`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    const { endpoint, keys } = body?.subscription ?? {};
    if (typeof endpoint !== 'string' || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    pushEndpoints.set(endpoint, user.id);
    return new HttpResponse(null, { status: 201 });
  }),

  http.delete(`${API_V1}/push/subscribe`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    if (typeof body?.endpoint !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    if (pushEndpoints.get(body.endpoint) !== user.id) return error(404, 'NOT_FOUND', 'Suscripción no encontrada');
    pushEndpoints.delete(body.endpoint);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/users/me/reminder-settings`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json(reminders.get(user.id) ?? { time: null, timezone: user.timezone });
  }),

  http.put(`${API_V1}/users/me/reminder-settings`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    if (!body || !(body.time === null || typeof body.time === 'string') || typeof body.timezone !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    if (body.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'time', problem: 'Debe tener el formato HH:mm (00:00 a 23:59) o ser null' },
      ]);
    }
    const settings = { time: body.time, timezone: body.timezone };
    reminders.set(user.id, settings);
    return HttpResponse.json(settings);
  }),

  http.delete(`${API_V1}/transactions/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const list = transactions.get(user.id) ?? [];
    if (!list.some((t) => t.id === params.id)) return error(404, 'NOT_FOUND', 'Transacción no encontrada');
    transactions.set(user.id, list.filter((t) => t.id !== params.id));
    return new HttpResponse(null, { status: 204 });
  }),
];
