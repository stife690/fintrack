import { listMovements } from '../repositories/analytics.repository.js';
import * as budgets from './budgets.service.js';
import { todayIso } from './insights.service.js';

/**
 * Analítica del mes (FT-0019): proyección de fin de mes, gastos hormiga y puntaje de salud
 * financiera. Todo se calcula aquí con fórmulas fijas; nada de esto va a la IA.
 */

/** Categorías de gasto fijo: se pagan una vez al mes, así que no se proyectan por ritmo diario. */
export const FIXED_CATEGORIES = ['vivienda', 'servicios_publicos'];

/** Días del mes desde los que la proyección es confiable. */
export const MIN_PROJECTION_DAYS = 3;

/** Un gasto hormiga es uno de este monto o menos (COP). */
export const SMALL_EXPENSE_MAX = 20000;

/** Desde cuántos gastos hormiga en el mes se avisa. */
export const SMALL_EXPENSE_MIN_COUNT = 5;

/** Meses completos anteriores contra los que se compara el gasto. */
export const STABILITY_MONTHS = 3;

/** Puntos de cada una de las cuatro partes del puntaje (suman 100). */
const PART_MAX = 25;

const round = (value) => Math.round(value);
const roundPct = (value) => Math.round(value * 10) / 10;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const sum = (movements) => movements.reduce((acc, m) => acc + m.amount, 0);

/**
 * Días que tiene un mes.
 * @param {string} month AAAA-MM
 * @returns {number}
 */
export function daysInMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/**
 * Primer día del mes que está `offset` meses antes (o después) de `month`.
 * @param {string} month AAAA-MM
 * @param {number} offset
 * @returns {string} AAAA-MM
 */
export function shiftMonth(month, offset) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7);
}

/**
 * (1) Proyección de fin de mes. Los gastos fijos cuentan una vez; los variables se proyectan con
 * el ritmo diario: `fijos + pendientes + (variables ÷ días transcurridos) × días del mes`.
 * Un fijo que el mes pasado se pagó y este mes todavía no, se suma como pendiente.
 * Los ingresos esperados son los de este mes o, si todavía son menos, los del mes pasado.
 *
 * @param {{ current: import('../repositories/analytics.repository.js').AnalyticsMovement[], previous: import('../repositories/analytics.repository.js').AnalyticsMovement[], day: number, days: number }} data
 *   `current`: movimientos del mes hasta hoy; `previous`: los del mes pasado completo; `day`: día de hoy.
 * @returns {{ available: boolean, spent: number, projected: number, pendingFixed: number, expectedIncome: number, balance: number }}
 */
export function projectMonth({ current, previous, day, days }) {
  const expenses = current.filter((m) => m.type === 'gasto');
  const isFixed = (m) => FIXED_CATEGORIES.includes(m.category);
  const fixed = sum(expenses.filter(isFixed));
  const variable = sum(expenses.filter((m) => !isFixed(m)));

  let pendingFixed = 0;
  for (const category of FIXED_CATEGORIES) {
    const paidNow = expenses.some((m) => m.category === category);
    const paidBefore = sum(previous.filter((m) => m.type === 'gasto' && m.category === category));
    if (!paidNow) pendingFixed += paidBefore;
  }

  const projected = fixed + pendingFixed + (variable / day) * days;
  const expectedIncome = Math.max(
    sum(current.filter((m) => m.type === 'ingreso')),
    sum(previous.filter((m) => m.type === 'ingreso')),
  );
  return {
    available: day >= MIN_PROJECTION_DAYS,
    spent: round(fixed + variable),
    projected: round(projected),
    pendingFixed: round(pendingFixed),
    expectedIncome: round(expectedIncome),
    balance: round(expectedIncome - projected),
  };
}

/**
 * Descripción para agrupar: sin tildes, en minúsculas y con un solo espacio ("Café " = "cafe").
 * @param {string} text
 * @returns {string}
 */
export function normalizeDescription(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * (2) Gastos hormiga: los de `SMALL_EXPENSE_MAX` o menos. Se avisa (`flagged`) desde
 * `SMALL_EXPENSE_MIN_COUNT` en el mes. `yearly` es lo que sumarían en un año a este ritmo.
 *
 * @param {{ current: import('../repositories/analytics.repository.js').AnalyticsMovement[], day: number, days: number }} data
 * @returns {{ threshold: number, count: number, total: number, share: number, yearly: number, flagged: boolean, top: Array<{ description: string, count: number, total: number }> }}
 *   `share`: porcentaje del gasto del mes; `top`: las 3 descripciones que más se repiten.
 */
export function smallExpenses({ current, day, days }) {
  const expenses = current.filter((m) => m.type === 'gasto');
  const small = expenses.filter((m) => m.amount <= SMALL_EXPENSE_MAX);
  const total = sum(small);
  const expenseTotal = sum(expenses);

  const groups = new Map();
  for (const m of small) {
    const key = normalizeDescription(m.description);
    const group = groups.get(key) ?? { description: m.description.trim(), count: 0, total: 0 };
    group.count += 1;
    group.total += m.amount;
    groups.set(key, group);
  }
  const top = [...groups.values()]
    .filter((g) => g.count > 1)
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 3)
    .map((g) => ({ ...g, total: round(g.total) }));

  return {
    threshold: SMALL_EXPENSE_MAX,
    count: small.length,
    total: round(total),
    share: expenseTotal > 0 ? roundPct((total / expenseTotal) * 100) : 0,
    yearly: round((total / day) * days * 12),
    flagged: small.length >= SMALL_EXPENSE_MIN_COUNT,
    top,
  };
}

/**
 * Puntos de una parte del puntaje: `PART_MAX` en `best`, 0 en `worst` y en línea recta entre ambos.
 * @param {number} value
 * @param {number} best
 * @param {number} worst
 * @returns {number}
 */
export function linearPoints(value, best, worst) {
  return PART_MAX * clamp01((value - worst) / (best - worst));
}

/**
 * Nivel del puntaje.
 * @param {number} score 0 a 100.
 * @returns {'excellent'|'good'|'attention'|'risk'}
 */
export function healthLevel(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'risk';
}

/**
 * (3) Puntaje de salud financiera, de 0 a 100: cuatro partes de 25 puntos.
 * - Ahorro: (ingresos − gastos) ÷ ingresos. 20 % o más (regla 50/30/20) = 25; 0 % o menos = 0.
 * - Presupuestos: los que no se han pasado del 100 %. Sin presupuestos, la mitad (12,5).
 * - Estabilidad: gasto del mes frente al promedio de los meses anteriores con movimientos.
 *   Igual o menor = 25; 30 % más o peor = 0. Sin meses anteriores, la mitad.
 * - Gastos hormiga: 5 % del gasto o menos = 25; 20 % o más = 0.
 * Se usa el gasto proyectado del mes; los primeros días, el gastado (la proyección aún no sirve).
 *
 * @param {{ income: number, expense: number, budgets: Array<{ percentage: number }>, previousExpenses: number[], smallShare: number }} data
 * @returns {{ score: number, level: string, parts: Array<{ key: string, points: number, value: number|null }> }}
 *   `value`: el dato de cada parte (porcentaje de ahorro, presupuestos cumplidos, variación o
 *   porcentaje hormiga), o `null` si no hay con qué calcularla.
 */
export function healthScore({
  income,
  expense,
  budgets: monthBudgets,
  previousExpenses,
  smallShare,
}) {
  const half = PART_MAX / 2;

  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : null;
  const savings = savingsRate === null ? 0 : linearPoints(savingsRate, 20, 0);

  const kept = monthBudgets.filter((b) => b.percentage < 100).length;
  const budgetsPoints = monthBudgets.length ? (kept / monthBudgets.length) * PART_MAX : half;

  const withData = previousExpenses.filter((total) => total > 0);
  const average = withData.length ? withData.reduce((a, b) => a + b, 0) / withData.length : 0;
  const change = average > 0 ? (expense / average - 1) * 100 : null;
  const stability = change === null ? half : linearPoints(change, 0, 30);

  const small = linearPoints(smallShare, 5, 20);

  const parts = [
    { key: 'savings', points: savings, value: savingsRate === null ? null : roundPct(savingsRate) },
    { key: 'budgets', points: budgetsPoints, value: monthBudgets.length ? kept : null },
    { key: 'stability', points: stability, value: change === null ? null : roundPct(change) },
    { key: 'small_expenses', points: small, value: smallShare },
  ].map((p) => ({ ...p, points: Math.round(p.points * 10) / 10 }));
  const score = Math.round(parts.reduce((acc, p) => acc + p.points, 0));
  return { score, level: healthLevel(score), parts };
}

/**
 * Crea el servicio de analítica. Las dependencias se pueden reemplazar en las pruebas.
 * @param {object} [deps]
 * @param {(userId: string, range: { from: string, to: string }) => Promise<import('../repositories/analytics.repository.js').AnalyticsMovement[]>} [deps.listMovements]
 * @param {(userId: string, month: string) => Promise<Array<{ percentage: number }>>} [deps.listBudgets]
 * @param {() => Date} [deps.now]
 * @returns {{ getAnalytics: (userId: string) => Promise<object> }}
 */
export function createAnalyticsService(deps = {}) {
  const movementsOf = deps.listMovements ?? listMovements;
  const budgetsOf = deps.listBudgets ?? budgets.list;
  const now = deps.now ?? (() => new Date());

  /**
   * Analítica del mes actual del usuario (proyección, gastos hormiga y puntaje).
   * @param {string} userId
   * @returns {Promise<object>} Ver `GET /api/v1/analytics` en `docs/api/openapi.yaml`.
   */
  async function getAnalytics(userId) {
    const today = todayIso(now());
    const month = today.slice(0, 7);
    const day = Number(today.slice(8, 10));
    const days = daysInMonth(month);
    const firstMonth = shiftMonth(month, -STABILITY_MONTHS);

    const [movements, monthBudgets] = await Promise.all([
      movementsOf(userId, { from: `${firstMonth}-01`, to: today }),
      budgetsOf(userId, month),
    ]);
    const inMonth = (m, target) => m.date.startsWith(target);
    const current = movements.filter((m) => inMonth(m, month));
    const previous = movements.filter((m) => inMonth(m, shiftMonth(month, -1)));
    const previousExpenses = Array.from({ length: STABILITY_MONTHS }, (_, i) =>
      sum(movements.filter((m) => m.type === 'gasto' && inMonth(m, shiftMonth(month, -(i + 1))))),
    );

    const projection = projectMonth({ current, previous, day, days });
    const small = smallExpenses({ current, day, days });
    const health = healthScore({
      income: projection.expectedIncome,
      expense: projection.available ? projection.projected : projection.spent,
      budgets: monthBudgets,
      previousExpenses,
      smallShare: small.share,
    });

    return {
      month,
      day,
      daysInMonth: days,
      empty: current.length === 0,
      projection,
      smallExpenses: small,
      health,
    };
  }

  return { getAnalytics };
}

export const { getAnalytics } = createAnalyticsService();
