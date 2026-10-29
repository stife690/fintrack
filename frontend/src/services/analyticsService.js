/**
 * Capa de analítica del frontend, según `docs/api/openapi.yaml` (FT-0019).
 * Llama a `GET /api/v1/analytics`: proyección de fin de mes, gastos hormiga y puntaje de salud
 * financiera, calculados en el servidor con fórmulas fijas (sin IA).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} Analytics
 * @property {string} month AAAA-MM
 * @property {number} day Día de hoy.
 * @property {number} daysInMonth
 * @property {boolean} empty `true` si el mes aún no tiene movimientos.
 * @property {{ available: boolean, spent: number, projected: number, pendingFixed: number, expectedIncome: number, balance: number }} projection
 * @property {{ threshold: number, count: number, total: number, share: number, yearly: number, flagged: boolean, top: Array<{ description: string, count: number, total: number }> }} smallExpenses
 * @property {{ score: number, level: 'excellent'|'good'|'attention'|'risk', parts: Array<{ key: string, points: number, value: number|null }> }} health
 */

/** @returns {Promise<Analytics>} */
export function getAnalytics() {
  return apiRequest('/analytics');
}
