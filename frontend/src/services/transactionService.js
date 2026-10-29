/**
 * Capa de transacciones del frontend, según `docs/api/openapi.yaml`.
 *
 * Llama a `/api/v1/transactions` y `/api/v1/categories` con el access token de la sesión.
 * Los errores de la API (`{ error: { code, message, details? } }`) se convierten en un
 * `Error` con mensaje para el usuario; en los 422, `err.fields` trae el problema por campo.
 */
import { authFetch } from '@/lib/authFetch';
import { registerCategories } from '@/lib/categoryStyles';
import { db } from '@/offline/db';

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
 * @typedef {object} TransactionAlert
 * @property {'none'|'warning_80'|'exceeded_100'} level
 * @property {number} percentage Porcentaje consumido del presupuesto de la categoría.
 */

/**
 * @typedef {object} TransactionWithAlert
 * @property {Transaction} transaction
 * @property {TransactionAlert|null} alert `null` si no es un gasto o la categoría no tiene presupuesto.
 */

/**
 * @typedef {object} Category
 * @property {string} key
 * @property {string} name
 * @property {string|null} [icon] Ícono elegido (solo las propias).
 * @property {string|null} [color] Color elegido (solo las propias).
 * @property {boolean} [custom] `true` si la creó el usuario.
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
  let res;
  try {
    res = await authFetch(path, { method, body });
  } catch (cause) {
    if (cause.code === 'REFRESH_FAILED') throw cause;
    const err = new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
    // Permite a la página guardar el movimiento en la cola offline (FT-0009).
    err.code = 'NETWORK_ERROR';
    throw err;
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

/**
 * Catálogo cerrado de categorías separado por tipo (`GET /categories`).
 * Se guarda una copia en el dispositivo para poder registrar movimientos sin conexión (FT-0009).
 * @returns {Promise<{ expense: Category[], income: Category[] }>}
 */
export async function getCategories() {
  try {
    const categories = await request('/categories');
    await db.meta.put({ key: 'categories', value: categories }).catch(() => {});
    return withStyles(categories);
  } catch (err) {
    const cached = err.code === 'NETWORK_ERROR' && (await db.meta.get('categories').catch(() => null));
    if (cached) return withStyles(cached.value);
    throw err;
  }
}

/**
 * Registra el ícono y el color de las categorías propias y devuelve la misma respuesta.
 * @param {{ expense: Category[], income: Category[] }} categories
 * @returns {{ expense: Category[], income: Category[] }}
 */
function withStyles(categories) {
  registerCategories([...categories.expense, ...categories.income]);
  return categories;
}

/** Evento de `window` al crear una categoría propia: las pantallas la agregan a su lista. */
export const CATEGORY_CREATED_EVENT = 'fintrack:category-created';

/**
 * Crea una categoría propia (máximo 20 por usuario). Necesita conexión. Los errores traen
 * `code`: `CATEGORY_EXISTS` (nombre repetido) o `CATEGORY_LIMIT`.
 * @param {{ name: string, type: 'gasto'|'ingreso', icon: string, color: string }} input
 * @returns {Promise<Category & { type: 'gasto'|'ingreso' }>} La categoría creada, con su tipo.
 */
export async function createCategory(input) {
  const created = { ...(await request('/categories', { method: 'POST', body: input })), type: input.type };
  registerCategories([created]);
  window.dispatchEvent(new CustomEvent(CATEGORY_CREATED_EVENT, { detail: created }));
  return created;
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
 * @returns {Promise<TransactionWithAlert>} La transacción y la alerta de presupuesto (`null` si no aplica).
 */
export function createTransaction(data) {
  return request('/transactions', { method: 'POST', body: data });
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
 * @returns {Promise<TransactionWithAlert>}
 */
export function updateTransaction(id, changes) {
  return request(`/transactions/${id}`, { method: 'PUT', body: changes });
}

/**
 * Elimina (borrado lógico) una transacción.
 * @param {string} id
 * @returns {Promise<null>}
 */
export function deleteTransaction(id) {
  return request(`/transactions/${id}`, { method: 'DELETE' });
}
