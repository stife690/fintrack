/**
 * Capa de transacciones del frontend, según `docs/api/openapi.yaml`.
 *
 * Llama a `/api/v1/transactions` y `/api/v1/categories` con el access token de la sesión.
 * Los errores de la API (`{ error: { code, message, details? } }`) se convierten en un
 * `Error` con mensaje para el usuario; en los 422, `err.fields` trae el problema por campo.
 */
import { API_V1 } from '@/lib/api';
import { getSession } from '@/auth/tokenStorage';

/**
 * @typedef {object} Transaction
 * @property {string} id
 * @property {number} amount Monto positivo; el signo lo da `type`.
 * @property {string} description
 * @property {'ingreso'|'gasto'} type
 * @property {string|null} category Clave de la categoría, o `null` si está sin clasificar.
 * @property {'manual'|'ia'|'sin_clasificar'} source Cómo se asignó la categoría.
 * @property {string} date Fecha AAAA-MM-DD.
 */

/**
 * @typedef {object} Category
 * @property {string} key
 * @property {string} name
 */

const SESSION_EXPIRED = 'Tu sesión venció. Inicia sesión de nuevo.';

/**
 * Hace una petición autenticada y devuelve el JSON (o `null` si la respuesta es 204).
 * @param {string} path Ruta bajo `/api/v1`.
 * @param {{ method?: string, body?: object }} [options]
 * @returns {Promise<any>}
 * @throws {Error} Con `code` y, en validaciones, `fields`.
 */
async function request(path, { method = 'GET', body } = {}) {
  const session = getSession();
  let res;
  try {
    res = await fetch(`${API_V1}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(session && { Authorization: `Bearer ${session.accessToken}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code, message, details } = data.error ?? {};
    const err = new Error(
      code === 'UNAUTHORIZED'
        ? SESSION_EXPIRED
        : details?.[0]?.problem || message || 'Algo salió mal. Inténtalo de nuevo.',
    );
    err.code = code;
    if (details) err.fields = Object.fromEntries(details.map((d) => [d.field, d.problem]));
    throw err;
  }
  return data;
}

/**
 * Catálogo cerrado de categorías separado por tipo (`GET /categories`).
 * @returns {Promise<{ expense: Category[], income: Category[] }>}
 */
export function getCategories() {
  return request('/categories');
}

/**
 * Lista paginada de transacciones propias, de la más reciente a la más antigua.
 * @param {{ type?: string, category?: string, q?: string, from?: string, to?: string, page?: number, pageSize?: number }} [filters]
 * @returns {Promise<{ data: Transaction[], page: number, pageSize: number, total: number }>}
 */
export function listTransactions(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return request(`/transactions${query ? `?${query}` : ''}`);
}

/**
 * Registra una transacción. Sin `category` la API la sugiere con IA (REQ-010); si la IA
 * no está disponible queda `sin_clasificar` y se guarda igual (REQ-011).
 * @param {{ amount: number, description: string, type: string, date: string, category?: string|null }} data
 * @returns {Promise<Transaction>}
 */
export async function createTransaction(data) {
  // El contrato responde { transaction, alert }; la alerta de presupuesto llega con F5/F6.
  const { transaction } = await request('/transactions', { method: 'POST', body: data });
  return transaction;
}

/**
 * Obtiene una transacción puntual, para abrir la edición sin tener el listado en memoria.
 * @param {string} id
 * @returns {Promise<Transaction>}
 */
export function getTransaction(id) {
  return request(`/transactions/${id}`);
}

/**
 * Modifica una transacción; solo se envían los campos que cambian.
 * @param {string} id
 * @param {Partial<{ amount: number, description: string, type: string, date: string, category: string|null }>} changes
 * @returns {Promise<Transaction>}
 */
export async function updateTransaction(id, changes) {
  const { transaction } = await request(`/transactions/${id}`, { method: 'PUT', body: changes });
  return transaction;
}

/**
 * Elimina (borrado lógico) una transacción.
 * @param {string} id
 * @returns {Promise<null>}
 */
export function deleteTransaction(id) {
  return request(`/transactions/${id}`, { method: 'DELETE' });
}
