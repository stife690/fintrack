import { http, HttpResponse, delay } from 'msw';
import { API_V1 } from '@/lib/api';
import { plainText } from '@/lib/plainText';

/**
 * Handlers de MSW que simulan auth, categorías y transacciones mientras se desarrolla sin backend.
 * Siguen `docs/api/openapi.yaml` (v2.0.1): rutas bajo `/api/v1`, errores con la forma
 * `{ error: { code, message, details? } }` y `AuthResponse` con tokens.
 * Los usuarios y sesiones viven en memoria: se reinician al recargar la página.
 */

/** @type {Map<string, { id: string, email: string, password: string, timezone: string, verified: boolean }>} */
const users = new Map();
/** token del enlace para confirmar el correo → email (FT-0016) */
const verificationTokens = new Map();
/** access token → email */
const accessTokens = new Map();
/** refresh token → email */
const refreshTokens = new Map();
let whatsappLinked = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Llave pública VAPID de ejemplo (válida, solo para desarrollo): permite suscribirse sin backend. */
const MOCK_VAPID_PUBLIC_KEY =
  'BKQMg0AmJJ34cFCv2R9ZhYsC5nfn4yDHX59UkDTz9Oxt7hVPlf6syvjSKfGKnk3TbL73wdayjvf5NNN5fsevPJU';
/** endpoint de suscripción push → id del usuario */
const pushEndpoints = new Map();
/** id del usuario → configuración del recordatorio diario */
const reminders = new Map();
/** Bandeja de avisos por usuario (FT-0045); arranca con un ejemplo para ver la campana. */
const inboxes = new Map();
/** Cuentas por cobrar y por pagar (FT-0046) por usuario. */
const debtsByUser = new Map();
/** Pagos de Apple Pay por confirmar (FT-0047) y token del Atajo, por usuario. */
const pendingByUser = new Map();
const shortcutTokens = new Map();

/** Pagos de ejemplo para ver "Por confirmar" en local; el segundo parece repetido. */
function pendingFor(userId) {
  if (!pendingByUser.has(userId)) {
    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toISOString();
    pendingByUser.set(userId, [
      {
        id: crypto.randomUUID(),
        merchant: 'Éxito Calle 80',
        amount: 45900,
        date: today,
        card: 'Visa Bancolombia',
        status: 'pending',
        transactionId: null,
        possibleDuplicate: false,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        merchant: 'Juan Valdez',
        amount: 12500,
        date: today,
        card: 'Visa Bancolombia',
        status: 'pending',
        transactionId: null,
        possibleDuplicate: true,
        createdAt: now,
      },
    ]);
  }
  return pendingByUser.get(userId);
}

addUser('demo@fintrack.com', 'demo1234');

function addUser(email, password, verified = true) {
  const user = { id: crypto.randomUUID(), email, password, timezone: 'America/Bogota', verified };
  users.set(email, user);
  return user;
}

/**
 * "Envía" el enlace para confirmar el correo: como el backend sin Brevo, lo imprime en la consola
 * para poder abrirlo a mano. Solo sirve el último enlace de cada correo.
 */
function sendVerificationLink(email) {
  for (const [token, owner] of verificationTokens) if (owner === email) verificationTokens.delete(token);
  const token = crypto.randomUUID();
  verificationTokens.set(token, email);
  console.info(`[correo simulado] Para: ${email} | ${window.location.origin}/verificar#token=${token}`);
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

/** Ideas de ejemplo de Lo que viene (FT-0026). */
const ideas = [
  { id: 'idea-1', title: 'Registrar gastos por WhatsApp', status: 'en_progreso', votes: 12 },
  { id: 'idea-2', title: 'Metas de ahorro personales', status: 'planeada', votes: 7 },
  { id: 'idea-3', title: 'Registro por voz', status: 'lista', votes: 20 },
  { id: 'idea-4', title: 'Dividir gastos con amigos', status: 'revision', votes: 0 },
];
const ideaVotes = new Set();

/** Perfil de Mi plata por usuario. */
const moneyProfiles = new Map();

/** @returns {object} El perfil del usuario; vacío si todavía no tiene. */
function moneyProfileOf(userId) {
  if (!moneyProfiles.has(userId)) {
    moneyProfiles.set(userId, {
      incomeType: null,
      payDays: [],
      balance: null,
      balanceAt: null,
      money: null,
      totals: { income: 0, expense: 0 },
      welcomeDone: false,
      commitments: [],
    });
  }
  return moneyProfiles.get(userId);
}

export const handlers = [
  http.post(`${API_V1}/auth/register`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    const invalid = checkCredentials(body);
    if (invalid) return invalid;
    const email = body.email.trim().toLowerCase();
    if (users.has(email)) return error(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
    addUser(email, body.password, false);
    sendVerificationLink(email);
    return HttpResponse.json({ email, verificationRequired: true }, { status: 201 });
  }),

  http.post(`${API_V1}/auth/verify-email`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    if (!body || typeof body.token !== 'string' || body.token === '') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const email = verificationTokens.get(body.token);
    if (!email) return error(400, 'INVALID_VERIFICATION_TOKEN', 'El enlace no es válido o ya venció.');
    verificationTokens.delete(body.token);
    const user = users.get(email);
    user.verified = true;
    return HttpResponse.json(issueSession(user));
  }),

  http.post(`${API_V1}/auth/resend-verification`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (users.get(email)?.verified === false) sendVerificationLink(email);
    return HttpResponse.json({
      message: 'Si el correo tiene una cuenta sin confirmar, te enviamos un enlace nuevo.',
    });
  }),

  // Google: en desarrollo cualquier credential entra como una cuenta de Google de prueba.
  http.post(`${API_V1}/auth/google`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    if (!body || typeof body.credential !== 'string' || body.credential === '') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const email = 'cuenta.google@example.com';
    return HttpResponse.json(issueSession(users.get(email) ?? addUser(email, crypto.randomUUID())));
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
    if (!user.verified) {
      return error(403, 'EMAIL_NOT_VERIFIED', 'Confirma tu correo para entrar.');
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
    return HttpResponse.json({ id: user.id, email: user.email, timezone: user.timezone, isAdmin: true });
  }),

  http.get(`${API_V1}/categories`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const pick = (type) =>
      CATALOG.filter((c) => c.type === type).map(({ key, name, icon = null, color = null, custom = false }) => ({
        key,
        name,
        icon,
        color,
        custom,
      }));
    return HttpResponse.json({ expense: pick('gasto'), income: pick('ingreso') });
  }),

  // Categorías propias: en los mocks se agregan al mismo catálogo (no se separan por usuario).
  http.post(`${API_V1}/categories`, async ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 30 || !['gasto', 'ingreso'].includes(body?.type)) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [{ field: 'name', problem: 'Debe tener entre 1 y 30 caracteres' }]);
    }
    if (CATALOG.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return error(409, 'CATEGORY_EXISTS', 'Ya tienes una categoría con ese nombre');
    }
    if (CATALOG.filter((c) => c.custom).length >= 20) {
      return error(409, 'CATEGORY_LIMIT', 'Puedes tener hasta 20 categorías propias');
    }
    await delay(400);
    const category = {
      key: `c_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
      name,
      type: body.type,
      icon: body.icon,
      color: body.color,
      custom: true,
    };
    CATALOG.push(category);
    const { key, icon, color, custom } = category;
    return HttpResponse.json({ key, name, icon, color, custom }, { status: 201 });
  }),

  http.patch(`${API_V1}/categories/:key`, async ({ request, params }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const category = CATALOG.find((c) => c.key === params.key && c.custom);
    if (!category) return error(404, 'NOT_FOUND', 'Categoría no encontrada');
    const body = (await readJson(request)) ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : category.name;
    if (CATALOG.some((c) => c !== category && c.name.toLowerCase() === name.toLowerCase())) {
      return error(409, 'CATEGORY_EXISTS', 'Ya tienes una categoría con ese nombre');
    }
    Object.assign(category, { name, icon: body.icon ?? category.icon, color: body.color ?? category.color });
    const { key, icon, color, custom } = category;
    return HttpResponse.json({ key, name, icon, color, custom });
  }),

  http.delete(`${API_V1}/categories/:key`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const index = CATALOG.findIndex((c) => c.key === params.key && c.custom);
    if (index === -1) return error(404, 'NOT_FOUND', 'Categoría no encontrada');
    const [category] = CATALOG.splice(index, 1);
    const fallback = category.type === 'gasto' ? 'otros' : 'otros_ingresos';
    let moved = 0;
    for (const t of transactions.get(user.id) ?? []) {
      if (t.category === category.key) {
        t.category = fallback;
        moved += 1;
      }
    }
    return HttpResponse.json({ moved });
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
      .filter((t) => (!q.get('q') || plainText(t.description).includes(plainText(q.get('q')))))
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
        'Aún no hay suficiente historial. Registra movimientos durante al menos una semana para recibir consejos.',
      );
    }
    // Como la API con menos de un mes de historial: la semana actual, desde el lunes.
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    return HttpResponse.json({
      period: 'week',
      month: today.toISOString().slice(0, 7),
      from: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`,
      insights: [
        {
          type: 'saving_opportunity',
          title: 'Gastas más en alimentación',
          detail: 'Esta semana llevas 18 % más que la anterior. Reducir los domicilios a 2 por semana podría ahorrarte $30.000.',
        },
        {
          type: 'positive_trend',
          title: 'Transporte a la baja',
          detail: 'Gastaste $12.000 menos que la semana pasada en transporte.',
        },
      ],
    });
  }),

  // Analítica (FT-0019): valores de ejemplo; el cálculo real está en el backend.
  http.get(`${API_V1}/analytics`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    await delay(400);
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return HttpResponse.json({
      month: today.toISOString().slice(0, 7),
      day: today.getDate(),
      daysInMonth,
      empty: (transactions.get(user.id) ?? []).length === 0,
      // Gasto acumulado de ejemplo que llega a $ 1.840.000 hoy, con un arriendo el día 1.
      daily: Array.from({ length: today.getDate() }, (_, i) => ({
        day: i + 1,
        total: Math.round(900000 + (940000 * (i + 1)) / today.getDate()),
      })),
      previousScore: 60,
      projection: {
        available: today.getDate() >= 3,
        spent: 1840000,
        projected: 2310000,
        pendingFixed: 0,
        oneOff: 0,
        saved: 0,
        income: 2800000,
        possibleIncome: 0,
        balance: 490000,
      },
      smallExpenses: {
        threshold: 20000,
        count: 14,
        total: 142000,
        share: 7.7,
        yearly: 1704000,
        flagged: true,
        top: [
          { description: 'Café', count: 6, total: 33000 },
          { description: 'Snacks', count: 4, total: 26000 },
          { description: 'Bus', count: 3, total: 9000 },
        ],
      },
      health: {
        score: 68,
        level: 'good',
        parts: [
          { key: 'savings', points: 21.9, value: 17.5 },
          { key: 'budgets', points: 16.7, value: 2 },
          { key: 'stability', points: 13.3, value: 14 },
          { key: 'small_expenses', points: 15.5, value: 7.7 },
        ],
      },
    });
  }),

  http.post(`${API_V1}/assistant/chat`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const question = (await readJson(request))?.messages?.at(-1)?.text?.toLowerCase() ?? '';
    await delay(900);
    if (question.includes('cdt')) {
      return HttpResponse.json({
        reply:
          'Para un CDT a 360 días el promedio es 12,77 % E.A. La que más paga es Banco Pichincha con 13,31 % (corte del 27/10/2026, Superintendencia Financiera).',
        toolsUsed: ['tasas_cdt'],
      });
    }
    const reply = question.includes('ahorr')
      ? 'Este mes llevas $1.500.000 de ingresos y $765.000 de gastos: te quedan unos $735.000. Si apartas el 20 % de tus ingresos, serían $300.000 de ahorro.'
      : question.includes('presupuesto')
        ? 'Vas bien en Transporte (52 %), pero Alimentación ya va en el 85 %: te quedan $75.000 para lo que resta del mes.'
        : 'Tu mayor gasto del mes es Alimentación, con $425.000. Le siguen Transporte ($210.000) y Ocio ($130.000).';
    return HttpResponse.json({ reply, toolsUsed: ['resumen_de_movimientos'] });
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
    return HttpResponse.json(reminders.get(user.id) ?? { times: [], time: null, timezone: user.timezone });
  }),

  http.put(`${API_V1}/users/me/reminder-settings`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    const raw = Array.isArray(body?.times) ? body.times : body?.time === null ? [] : [body?.time];
    if (!body || typeof body.timezone !== 'string' || !raw.every((t) => typeof t === 'string')) {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    if (!raw.every((t) => timeRe.test(t))) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'times', problem: 'Cada hora debe tener el formato HH:mm (00:00 a 23:59)' },
      ]);
    }
    const times = [...new Set(raw)].sort();
    if (times.length > 5) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'times', problem: 'Máximo 5 recordatorios al día' },
      ]);
    }
    const settings = { times, time: times[0] ?? null, timezone: body.timezone };
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

  http.get(`${API_V1}/money-profile`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json(moneyProfileOf(user.id));
  }),

  http.get(`${API_V1}/money-profile/plan`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ ready: false });
  }),

  http.put(`${API_V1}/money-profile`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    const { incomeType = null, payDays = [], balance = null } = await readJson(request);
    Object.assign(profile, {
      incomeType,
      payDays,
      balance,
      money: balance,
      balanceAt: balance === null ? null : new Date().toISOString(),
    });
    return HttpResponse.json(profile);
  }),

  http.post(`${API_V1}/money-profile/welcome`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    const { commitments = [], ...answers } = (await readJson(request)) ?? {};
    Object.assign(profile, answers, { welcomeDone: true });
    for (const item of commitments) profile.commitments.push({ id: crypto.randomUUID(), ...item });
    return HttpResponse.json(profile);
  }),

  http.post(`${API_V1}/money-profile/commitments`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    const body = await readJson(request);
    if (profile.commitments.some((c) => c.name.toLowerCase() === body.name.toLowerCase())) {
      return error(409, 'COMMITMENT_EXISTS', 'Ya tienes un compromiso con ese nombre');
    }
    const commitment = { id: crypto.randomUUID(), ...body };
    profile.commitments.push(commitment);
    return HttpResponse.json(commitment, { status: 201 });
  }),

  http.put(`${API_V1}/money-profile/commitments/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const commitment = moneyProfileOf(user.id).commitments.find((c) => c.id === params.id);
    if (!commitment) return error(404, 'NOT_FOUND', 'Compromiso no encontrado');
    Object.assign(commitment, await readJson(request));
    return HttpResponse.json(commitment);
  }),

  http.delete(`${API_V1}/money-profile/commitments/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    profile.commitments = profile.commitments.filter((c) => c.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/ideas`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const shown = ideas
      .filter((idea) => ['planeada', 'en_progreso', 'lista'].includes(idea.status))
      .map((idea) => {
        const voted = ideaVotes.has(idea.id);
        return { ...idea, votes: idea.votes + (voted ? 1 : 0), voted };
      })
      .sort((a, b) => b.votes - a.votes);
    return HttpResponse.json({
      upcoming: shown.filter((idea) => idea.status !== 'lista'),
      done: shown.filter((idea) => idea.status === 'lista'),
    });
  }),

  http.post(`${API_V1}/ideas`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const { title } = await readJson(request);
    return HttpResponse.json({ id: crypto.randomUUID(), title, status: 'revision' }, { status: 201 });
  }),

  http.get(`${API_V1}/ideas/admin`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ ideas: ideas.map((idea) => ({ ...idea, createdAt: new Date().toISOString() })) });
  }),

  http.post(`${API_V1}/ideas/admin`, async ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const idea = { id: crypto.randomUUID(), votes: 0, status: 'planeada', ...(await readJson(request)) };
    ideas.unshift(idea);
    return HttpResponse.json(idea, { status: 201 });
  }),

  http.patch(`${API_V1}/ideas/admin/:id`, async ({ request, params }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const idea = ideas.find(({ id }) => id === params.id);
    if (!idea) return error(404, 'NOT_FOUND', 'Idea no encontrada');
    Object.assign(idea, await readJson(request));
    return HttpResponse.json(idea);
  }),

  http.post(`${API_V1}/ideas/:id/vote`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    ideaVotes.add(params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API_V1}/ideas/:id/vote`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    ideaVotes.delete(params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/whatsapp/link`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({
      available: true,
      linked: whatsappLinked,
      phone: whatsappLinked ? '•••• 3374' : null,
      botNumber: '15551773374',
    });
  }),

  http.post(`${API_V1}/whatsapp/link`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    // En los mocks no hay bot: "Ya lo envié" encuentra el número conectado.
    whatsappLinked = true;
    return HttpResponse.json(
      { code: 'FT-AB23CD45', expiresAt: new Date(Date.now() + 600000).toISOString(), botNumber: '15551773374' },
      { status: 201 },
    );
  }),

  http.delete(`${API_V1}/whatsapp/link`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    whatsappLinked = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API_V1}/notifications`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    if (!inboxes.has(user.id)) {
      inboxes.set(user.id, [
        {
          id: crypto.randomUUID(),
          title: 'Presupuesto de Alimentación',
          body: 'Ya llevas el 85 % de lo que pusiste para este mes.',
          url: '/app/presupuestos',
          read: false,
          createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        },
      ]);
    }
    const items = inboxes.get(user.id);
    return HttpResponse.json({ items, unread: items.filter((n) => !n.read).length });
  }),
  http.post(`${API_V1}/notifications/read`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    for (const item of inboxes.get(user.id) ?? []) item.read = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/debts`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const items = debtsByUser.get(user.id) ?? [];
    const totals = { receivable: 0, payable: 0 };
    for (const d of items) if (!d.settledAt) totals[d.kind] += d.amount;
    const sorted = [...items].sort(
      (a, b) =>
        Boolean(a.settledAt) - Boolean(b.settledAt) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    );
    return HttpResponse.json({ items: sorted, totals });
  }),

  http.post(`${API_V1}/debts`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await request.json();
    if (!['receivable', 'payable'].includes(body.kind) || !body.person?.trim() || !(body.amount > 0)) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos');
    }
    const now = new Date().toISOString();
    const debt = {
      id: crypto.randomUUID(),
      kind: body.kind,
      person: body.person.trim(),
      amount: body.amount,
      dueDate: body.dueDate ?? null,
      note: body.note ?? null,
      settledAt: null,
      transactionId: null,
      createdAt: now,
      updatedAt: now,
    };
    debtsByUser.set(user.id, [...(debtsByUser.get(user.id) ?? []), debt]);
    return HttpResponse.json(debt, { status: 201 });
  }),

  http.put(`${API_V1}/debts/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const debt = (debtsByUser.get(user.id) ?? []).find((d) => d.id === params.id);
    if (!debt) return error(404, 'NOT_FOUND', 'Cuenta no encontrada');
    if (debt.settledAt) return error(409, 'ALREADY_SETTLED', 'Esta cuenta ya está saldada');
    Object.assign(debt, await request.json(), { updatedAt: new Date().toISOString() });
    return HttpResponse.json(debt);
  }),

  http.delete(`${API_V1}/debts/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const items = debtsByUser.get(user.id) ?? [];
    if (!items.some((d) => d.id === params.id)) return error(404, 'NOT_FOUND', 'Cuenta no encontrada');
    debtsByUser.set(user.id, items.filter((d) => d.id !== params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_V1}/debts/:id/settle`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const debt = (debtsByUser.get(user.id) ?? []).find((d) => d.id === params.id);
    if (!debt) return error(404, 'NOT_FOUND', 'Cuenta no encontrada');
    if (debt.settledAt) return error(409, 'ALREADY_SETTLED', 'Esta cuenta ya está saldada');
    const { createTransaction = true } = (await request.json().catch(() => ({}))) ?? {};
    debt.settledAt = new Date().toISOString();
    debt.transactionId = createTransaction ? crypto.randomUUID() : null;
    return HttpResponse.json({ debt, transaction: createTransaction ? { id: debt.transactionId } : null });
  }),

  http.get(`${API_V1}/pending-payments/token`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ enabled: true, token: shortcutTokens.get(user.id) ?? null });
  }),

  http.post(`${API_V1}/pending-payments/token`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const saved = { createdAt: new Date().toISOString(), lastUsedAt: null };
    shortcutTokens.set(user.id, saved);
    return HttpResponse.json({ token: `ftk_${crypto.randomUUID().replaceAll('-', '')}`, ...saved }, { status: 201 });
  }),

  http.delete(`${API_V1}/pending-payments/token`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    shortcutTokens.delete(user.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/pending-payments`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ items: pendingFor(user.id).filter((p) => p.status === 'pending') });
  }),

  http.post(`${API_V1}/pending-payments/:id/confirm`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const payment = pendingFor(user.id).find((p) => p.id === params.id);
    if (!payment) return error(404, 'NOT_FOUND', 'Pago no encontrado');
    if (payment.status !== 'pending') return error(409, 'ALREADY_RESOLVED', 'Este pago ya se confirmó o se descartó');
    const body = (await request.json().catch(() => ({}))) ?? {};
    await delay(400);
    const description = body.description ?? payment.merchant;
    const now = new Date().toISOString();
    const transaction = {
      id: crypto.randomUUID(),
      userId: user.id,
      amount: payment.amount,
      description,
      type: 'gasto',
      date: payment.date,
      ...resolve(body.category, description, 'gasto'),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    transactions.set(user.id, [transaction, ...(transactions.get(user.id) ?? [])]);
    Object.assign(payment, { status: 'confirmed', transactionId: transaction.id });
    return HttpResponse.json({ payment, transaction });
  }),

  http.post(`${API_V1}/pending-payments/:id/discard`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const payment = pendingFor(user.id).find((p) => p.id === params.id);
    if (!payment) return error(404, 'NOT_FOUND', 'Pago no encontrado');
    if (payment.status !== 'pending') return error(409, 'ALREADY_RESOLVED', 'Este pago ya se confirmó o se descartó');
    payment.status = 'discarded';
    return HttpResponse.json(payment);
  }),
];
