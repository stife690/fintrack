import { http, HttpResponse, delay } from 'msw';
import { API_V1 } from '@/lib/api';

/**
 * Handlers de MSW que simulan los endpoints de auth mientras el backend no los expone.
 * Siguen `fintrack-openapi.yaml` (v2.0.1): rutas bajo `/api/v1`, errores con la forma
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
];
