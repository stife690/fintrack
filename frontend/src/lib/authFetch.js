/**
 * Petición autenticada con renovación automática de sesión.
 *
 * El access token dura 15 min (`TOKEN_EXPIRED` al vencer). Cuando la API responde 401,
 * se cambia el refresh token por un par nuevo (`POST /auth/refresh`, con rotación) y la
 * petición se repite una sola vez. Si el refresh token también venció o fue revocado, la
 * sesión local se borra y se avisa con el evento `fintrack:session-expired`.
 *
 * Varias ventanas (la PWA instalada y una pestaña del navegador) comparten la sesión de
 * `localStorage`, y cada refresh token sirve una sola vez. Por eso las renovaciones se turnan
 * entre ventanas (`navigator.locks`) y, si otra ventana ya renovó, se usa su token en vez de
 * gastar el viejo: antes, la ventana que perdía la carrera borraba la sesión de todas.
 */
import { API_V1 } from '@/lib/api';
import { clearSession, getSession, saveSession } from '@/auth/tokenStorage';

/** Evento que se emite en `window` cuando la sesión ya no se puede renovar. */
export const SESSION_EXPIRED_EVENT = 'fintrack:session-expired';

/** Renovación en curso: varias peticiones a la vez comparten una sola (el refresh token rota). */
let refreshing = null;

/**
 * Cambia el refresh token de la sesión por tokens nuevos y los guarda.
 * @param {string} [usedRefreshToken] El refresh token que había cuando falló la petición. Si la
 *   sesión ya tiene otro, otra ventana renovó mientras tanto y no hace falta volver a hacerlo.
 * @returns {Promise<string|null>} El access token nuevo, o `null` si la sesión no se pudo renovar.
 * @throws {Error} Solo si no hay conexión con el servidor: en ese caso la sesión se conserva.
 */
export function refreshSession(usedRefreshToken) {
  const run = () => doRefresh(usedRefreshToken);
  // `navigator.locks`: una ventana renueva a la vez; las demás esperan y usan el token nuevo.
  refreshing ??= (navigator.locks ? navigator.locks.request('fintrack-refresh', run) : run()).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * @param {string} [usedRefreshToken]
 * @returns {Promise<string|null>}
 */
async function doRefresh(usedRefreshToken) {
  const session = getSession();
  if (!session?.refreshToken) return expire();
  if (usedRefreshToken && session.refreshToken !== usedRefreshToken) return session.accessToken;

  let res;
  try {
    res = await fetch(`${API_V1}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } catch {
    throw new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
  }
  if (res.status === 401 || res.status === 400) {
    // Sin `navigator.locks` (navegadores viejos) otra ventana pudo ganar la carrera: si ya guardó
    // tokens nuevos, se usan; si no, la sesión de verdad venció.
    const latest = getSession();
    if (latest?.refreshToken && latest.refreshToken !== session.refreshToken) return latest.accessToken;
    return expire();
  }
  // Con código: el servidor respondió (5xx), no es falta de conexión (no va a la cola offline).
  if (!res.ok) {
    throw Object.assign(new Error('No pudimos renovar tu sesión. Inténtalo de nuevo.'), {
      code: 'REFRESH_FAILED',
    });
  }

  const { accessToken, refreshToken } = await res.json();
  saveSession({ ...session, accessToken, refreshToken });
  return accessToken;
}

/** Borra la sesión local y avisa a la app para que lleve al login. */
function expire() {
  clearSession();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return null;
}

/**
 * `fetch` contra `/api/v1` con el access token de la sesión.
 * @param {string} path Ruta bajo `/api/v1`.
 * @param {{ method?: string, body?: object | Blob | (() => object) }} [options] Si `body` es una
 *   función se evalúa en cada intento (útil cuando incluye el refresh token, que rota). Un `Blob`
 *   (el audio del registro por voz) se envía tal cual, con su propio tipo.
 * @returns {Promise<Response>}
 */
export async function authFetch(path, { method = 'GET', body } = {}) {
  const send = (token) => {
    const payload = typeof body === 'function' ? body() : body;
    const raw = payload instanceof Blob;
    return fetch(`${API_V1}${path}`, {
      method,
      headers: {
        ...(payload !== undefined && { 'Content-Type': raw ? payload.type : 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: payload === undefined || raw ? payload : JSON.stringify(payload),
    });
  };

  const before = getSession();
  const res = await send(before?.accessToken);
  if (res.status !== 401) return res;
  // Sin sesión guardada (se cerró o venció en otra ventana): al login, no 401 en silencio.
  // `authFetch` solo se usa con rutas que piden sesión, así que no hay 401 "esperados" aquí.
  if (!getSession()?.refreshToken) {
    expire();
    return res;
  }

  const token = await refreshSession(before?.refreshToken);
  return token ? send(token) : res;
}
