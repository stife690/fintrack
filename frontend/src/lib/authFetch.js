/**
 * Petición autenticada con renovación automática de sesión.
 *
 * El access token dura 15 min (`TOKEN_EXPIRED` al vencer). Cuando la API responde 401,
 * se cambia el refresh token por un par nuevo (`POST /auth/refresh`, con rotación) y la
 * petición se repite una sola vez. Si el refresh token también venció o fue revocado, la
 * sesión local se borra y se avisa con el evento `fintrack:session-expired`.
 */
import { API_V1 } from '@/lib/api';
import { clearSession, getSession, saveSession } from '@/auth/tokenStorage';

/** Evento que se emite en `window` cuando la sesión ya no se puede renovar. */
export const SESSION_EXPIRED_EVENT = 'fintrack:session-expired';

/** Renovación en curso: varias peticiones a la vez comparten una sola (el refresh token rota). */
let refreshing = null;

/**
 * Cambia el refresh token de la sesión por tokens nuevos y los guarda.
 * @returns {Promise<string|null>} El access token nuevo, o `null` si la sesión no se pudo renovar.
 * @throws {Error} Solo si no hay conexión con el servidor: en ese caso la sesión se conserva.
 */
export function refreshSession() {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function doRefresh() {
  const session = getSession();
  if (!session?.refreshToken) return expire();

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
  if (res.status === 401 || res.status === 400) return expire();
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

  const res = await send(getSession()?.accessToken);
  if (res.status !== 401 || !getSession()?.refreshToken) return res;

  const token = await refreshSession();
  return token ? send(token) : res;
}
