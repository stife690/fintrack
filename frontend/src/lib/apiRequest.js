/**
 * Petición autenticada a la API con los errores ya traducidos para el usuario.
 *
 * Usa `authFetch` (access token y renovación automática de la sesión). Los errores de la API
 * (`{ error: { code, message, details? } }`) se convierten en un `Error` con mensaje legible,
 * su `code` y, en los 422, `fields` con el problema por campo.
 */
import { authFetch } from '@/lib/authFetch';

const SESSION_EXPIRED = 'Tu sesión venció. Inicia sesión de nuevo.';
export const CONNECTION_ERROR = 'No pudimos conectar con el servidor. Revisa tu conexión.';

/**
 * Convierte una respuesta de error de la API en un `Error` listo para mostrar.
 * @param {Response} res Respuesta con `res.ok === false`.
 * @returns {Promise<Error & { code?: string, fields?: Record<string, string> }>}
 */
export async function toApiError(res) {
  const data = await res.json().catch(() => ({}));
  const { code, message, details } = data.error ?? {};
  const err = new Error(
    code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED'
      ? SESSION_EXPIRED
      : details?.[0]?.problem || message || 'Algo salió mal. Inténtalo de nuevo.',
  );
  err.code = code;
  if (details) err.fields = Object.fromEntries(details.map((d) => [d.field, d.problem]));
  return err;
}

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
    throw new Error(CONNECTION_ERROR);
  }
  if (res.status === 204) return null;
  if (!res.ok) throw await toApiError(res);
  return res.json().catch(() => ({}));
}
