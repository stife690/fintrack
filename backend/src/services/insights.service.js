import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import {
  findFirstTransactionDate,
  findInsights,
  saveInsights,
} from '../repositories/insights.repository.js';
import { summarizeTransactions } from '../repositories/transactions.repository.js';
import { completeText } from './ai-client.service.js';
import { periodRange } from './transactions.service.js';

/** Horas que un resultado guardado se considera fresco antes de volver a pedirlo a la IA. */
export const CACHE_TTL_HOURS = 24;

/** Tipos de insight que entiende el frontend; cualquier otro se muestra como consejo general. */
const TYPES = ['saving_opportunity', 'overspending_alert', 'positive_trend', 'general_tip'];
const MAX_INSIGHTS = 4;

const SYSTEM_PROMPT =
  'Eres un asistente de finanzas personales para una app en pesos colombianos (COP). ' +
  'Recibes únicamente totales agregados por categoría de dos meses y devuelves consejos breves, ' +
  'concretos y amables en español. No inventes datos que no estén en la entrada. ' +
  'Responde ÚNICAMENTE con un arreglo JSON, sin texto adicional ni bloques de código.';

/**
 * Fecha de hoy (AAAA-MM-DD) en la zona horaria de la app, que es donde vive el usuario.
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {string}
 */
export function todayIso(now = new Date(), timeZone = 'America/Bogota') {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/**
 * Resta un mes a una fecha sin desbordar (31 de marzo → 28 o 29 de febrero).
 * @param {string} date AAAA-MM-DD
 * @returns {string} AAAA-MM-DD
 */
export function oneMonthBefore(date) {
  const [year, month, day] = date.split('-').map(Number);
  const lastDayOfPrevious = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(year, month - 2, Math.min(day, lastDayOfPrevious)));
  return target.toISOString().slice(0, 10);
}

/**
 * Pasa los totales de un mes a un texto compacto para el prompt: una línea por categoría.
 * @param {Array<{ category: string|null, total: number }>} rows
 * @param {Map<string, string>} names Clave → nombre de la categoría.
 * @returns {string}
 */
function describeMonth(rows, names) {
  if (rows.length === 0) return '- (sin gastos)';
  return rows
    .map(
      (r) =>
        `- ${r.category ? (names.get(r.category) ?? r.category) : 'Sin clasificar'}: ${r.total}`,
    )
    .join('\n');
}

/**
 * Arma el prompt con datos agregados (RN-05, RNF-09): ni descripciones, ni fechas sueltas, ni
 * identificadores del usuario. Solo totales por categoría del mes actual y del anterior.
 * @param {{ month: string, previousMonth: string, current: object, previous: object, names: Map<string, string> }} data
 * @returns {string}
 */
export function buildPrompt({ month, previousMonth, current, previous, names }) {
  return [
    `Mes actual (${month}, hasta hoy):`,
    `Ingresos totales: ${current.income}`,
    `Gastos totales: ${current.expenseTotal}`,
    'Gastos por categoría:',
    describeMonth(current.expenses, names),
    '',
    `Mes anterior (${previousMonth}):`,
    `Ingresos totales: ${previous.income}`,
    `Gastos totales: ${previous.expenseTotal}`,
    'Gastos por categoría:',
    describeMonth(previous.expenses, names),
    '',
    `Genera entre 2 y ${MAX_INSIGHTS} insights. Cada uno es un objeto con "type" (uno de: ${TYPES.join(', ')}), ` +
      '"title" (máximo 60 caracteres) y "detail" (máximo 250 caracteres, con cifras concretas cuando ayuden).',
  ].join('\n');
}

/**
 * Lee la respuesta del modelo: tolera bloques de código y texto alrededor, valida la forma y
 * recorta los textos.
 * @param {string} text Respuesta cruda del modelo.
 * @returns {Array<{ type: string, title: string, detail: string }>|null} `null` si no hay ningún insight utilizable.
 */
export function parseInsights(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  let raw;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const insights = [];
  for (const item of raw) {
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    const detail = typeof item?.detail === 'string' ? item.detail.trim() : '';
    if (!title || !detail) continue;
    insights.push({
      type: TYPES.includes(item.type) ? item.type : 'general_tip',
      title: title.slice(0, 80),
      detail: detail.slice(0, 300),
    });
    if (insights.length === MAX_INSIGHTS) break;
  }
  return insights.length > 0 ? insights : null;
}

/**
 * Crea el servicio de insights. Las dependencias se inyectan para probarlo sin BD ni IA.
 *
 * @param {object} [deps]
 * @param {{ findInsights: typeof findInsights, saveInsights: typeof saveInsights, findFirstTransactionDate: typeof findFirstTransactionDate, summarizeTransactions: typeof summarizeTransactions }} [deps.repository]
 * @param {typeof listCategories} [deps.listCategories]
 * @param {typeof completeText} [deps.completeText]
 * @param {() => Date} [deps.now]
 * @returns {{ getInsights: (userId: string) => Promise<{ month: string, insights: object[] }> }}
 */
export function createInsightsService(deps = {}) {
  const repo = deps.repository ?? {
    findInsights,
    saveInsights,
    findFirstTransactionDate,
    summarizeTransactions,
  };
  const getCategories = deps.listCategories ?? listCategories;
  const ask = deps.completeText ?? completeText;
  const now = deps.now ?? (() => new Date());

  /**
   * Totales de ingresos y gastos (por categoría) de un rango de fechas.
   * @param {string} userId
   * @param {{ from: string, to: string }} range
   * @returns {Promise<{ income: number, expenseTotal: number, expenses: Array<{ category: string|null, total: number }> }>}
   */
  async function totalsFor(userId, { from, to }) {
    const { byCategory } = await repo.summarizeTransactions({ userId, from, to, groupBy: 'month' });
    const expenses = byCategory.filter((r) => r.type === 'gasto');
    const sum = (rows) => Math.round(rows.reduce((acc, r) => acc + r.total, 0) * 100) / 100;
    return {
      income: sum(byCategory.filter((r) => r.type === 'ingreso')),
      expenseTotal: sum(expenses),
      expenses,
    };
  }

  /**
   * Insights del mes actual (REQ-020, REQ-021). Si hay un resultado guardado de hace menos de
   * `CACHE_TTL_HOURS` lo devuelve sin llamar a la IA; si no, lo genera y lo guarda. Si la IA
   * falla y hay un resultado anterior, devuelve ese en vez de un error.
   *
   * @param {string} userId
   * @returns {Promise<{ month: string, insights: Array<{ type: string, title: string, detail: string }> }>}
   * @throws {AppError} 422 `INSUFFICIENT_HISTORY`, 503 `AI_UNAVAILABLE`.
   */
  async function getInsights(userId) {
    const today = todayIso(now());
    const month = today.slice(0, 7);

    const cached = await repo.findInsights(userId, month);
    const ageHours = cached ? (now() - cached.generatedAt) / 3_600_000 : Infinity;
    if (cached && ageHours < CACHE_TTL_HOURS) return { month, insights: cached.insights };

    // Regla de negocio (REQ-021): hace falta al menos un mes de historial.
    const first = await repo.findFirstTransactionDate(userId);
    if (!first || first > oneMonthBefore(today)) {
      throw new AppError(
        422,
        'INSUFFICIENT_HISTORY',
        'Aún no hay suficiente historial. Registra movimientos durante al menos un mes para recibir insights.',
      );
    }

    const currentRange = { from: periodRange('month', today).from, to: today };
    const previousMonth = oneMonthBefore(`${month}-01`).slice(0, 7);
    const [current, previous, categories] = await Promise.all([
      totalsFor(userId, currentRange),
      totalsFor(userId, periodRange('month', `${previousMonth}-01`)),
      getCategories(),
    ]);
    if (current.expenseTotal === 0 && previous.expenseTotal === 0) {
      throw new AppError(
        422,
        'INSUFFICIENT_HISTORY',
        'No hay gastos suficientes en los últimos dos meses para generar insights.',
      );
    }

    const prompt = buildPrompt({
      month,
      previousMonth,
      current,
      previous,
      names: new Map(categories.map((c) => [c.key, c.name])),
    });

    try {
      const text = await ask({ system: SYSTEM_PROMPT, prompt, maxTokens: 900 });
      const insights = parseInsights(text);
      if (!insights)
        throw new AppError(503, 'AI_UNAVAILABLE', 'El servicio de IA no está disponible');
      await repo.saveInsights(userId, month, insights);
      return { month, insights };
    } catch (err) {
      // Mejor un consejo de hace unas horas que ninguno.
      if (cached && err instanceof AppError && err.code === 'AI_UNAVAILABLE') {
        return { month, insights: cached.insights };
      }
      throw err;
    }
  }

  return { getInsights };
}

const service = createInsightsService();

/** Servicio con las dependencias reales (BD e IA). */
export const { getInsights } = service;
