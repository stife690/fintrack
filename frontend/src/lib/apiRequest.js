/**
 * Petición autenticada a la API con los errores ya traducidos para el usuario.
 *
 * Usa `authFetch` (access token y renovación automática de la sesión). Los errores de la API
 * (`{ error: { code, message, details? } }`) se convierten en un `Error` con mensaje legible,
 * su `code` y, en los 422, `fields` con el problema por campo.
 */
import { authFetch } from '@/lib/authFetch';

const SESSION_EXPIRED = 'Tu sesión venció. Inicia sesión de nuevo.';

/**
 * @param {string} path Ruta bajo `/api/v1`.
 * @param {{ method?: string, body?: object }} [options]
 * @returns {Promise<any>} El JSON de la respuesta, o `null` si es 204.
 * @throws {Error} Con `code` y, en validaciones, `fields`.
 */
export async function apiRequest(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await authFetch(path, { method, body });
  } catch {
    throw new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code, message, details } = data.error ?? {};
    const err = new Error(
      code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED'
        ? SESSION_EXPIRED
        : details?.[0]?.problem || message || 'Algo salió mal. Inténtalo de nuevo.',
    );
    err.code = code;
    if (details) err.fields = Object.fromEntries(details.map((d) => [d.field, d.problem]));
    throw err;
  }
  return data;
}
