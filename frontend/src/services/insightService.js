/**
 * Capa de insights del frontend, según `docs/api/openapi.yaml` (FT-0007).
 * Llama a `GET /api/v1/insights`, que los genera con IA a partir de datos agregados.
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} Insight
 * @property {'saving_opportunity'|'overspending_alert'|'positive_trend'|'general_tip'} type
 * @property {string} title Resumen corto.
 * @property {string} detail Explicación con cifras.
 */

/**
 * Consejos de la semana actual (con menos de un mes de historial) o del mes actual. Los errores
 * traen `code`: `INSUFFICIENT_HISTORY` (menos de una semana de historial), `AI_UNAVAILABLE` (la IA
 * no respondió) o `RATE_LIMITED`.
 * @returns {Promise<{ period: 'week'|'month', month: string, from: string, insights: Insight[] }>}
 *   `from` es el primer día del periodo (el lunes o el día 1 del mes).
 */
export function getInsights() {
  return apiRequest('/insights');
}
