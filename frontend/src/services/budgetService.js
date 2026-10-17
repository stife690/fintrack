/**
 * Capa de presupuestos del frontend, según `docs/api/openapi.yaml` (FT-0005).
 * Llama a `/api/v1/budgets` con el access token de la sesión.
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} BudgetAlert
 * @property {'none'|'warning_80'|'exceeded_100'} level Desde el 80 % es advertencia; desde el 100 %, excedido (RN-04).
 * @property {number} percentage
 */

/**
 * @typedef {object} Budget
 * @property {string} id
 * @property {string} category Clave de una categoría de gasto.
 * @property {string} month Mes AAAA-MM.
 * @property {number} amount Límite del mes.
 * @property {number} consumed Gastado en esa categoría y mes.
 * @property {number} percentage `consumed / amount × 100`.
 * @property {BudgetAlert} alert
 */

/**
 * Presupuestos de un mes, con lo gastado, el porcentaje y la alerta.
 * @param {string} month AAAA-MM
 * @returns {Promise<Budget[]>}
 */
export function listBudgets(month) {
  return apiRequest(`/budgets?month=${encodeURIComponent(month)}`);
}

/**
 * Crea un presupuesto. Responde 409 `BUDGET_EXISTS` si ya hay uno para esa categoría y mes.
 * @param {{ category: string, month: string, amount: number }} data
 * @returns {Promise<{ id: string, category: string, month: string, amount: number }>}
 */
export function createBudget(data) {
  return apiRequest('/budgets', { method: 'POST', body: data });
}

/**
 * Cambia el límite de un presupuesto; devuelve el porcentaje recalculado.
 * @param {string} id
 * @param {number} amount
 * @returns {Promise<Budget>}
 */
export function updateBudget(id, amount) {
  return apiRequest(`/budgets/${id}`, { method: 'PUT', body: { amount } });
}

/**
 * Elimina un presupuesto.
 * @param {string} id
 * @returns {Promise<null>}
 */
export function deleteBudget(id) {
  return apiRequest(`/budgets/${id}`, { method: 'DELETE' });
}
