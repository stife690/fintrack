/**
 * Resumen del dashboard (FT-0004): ingresos, gastos, ahorro y balance de una semana, un mes o un año,
 * con el desglose por categoría y la serie en el tiempo para los gráficos.
 *
 * Usa `GET /transactions/summary`. Si la API responde 404 (backend sin desplegar todavía),
 * el resumen se calcula aquí sumando los movimientos del periodo, con la misma forma de respuesta,
 * así las pantallas no cambian.
 */
import { apiRequest } from '@/lib/apiRequest';
import { periodRange } from '@/lib/period';
import { listTransactions } from '@/services/transactionService';

/** Tope de seguridad del cálculo local: 20 páginas × 100 = 2.000 movimientos. */
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

/**
 * @typedef {{ category: string|null, total: number, percentage: number }} CategoryTotal
 * @typedef {{ total: number, byCategory: CategoryTotal[] }} TypeTotals
 * @typedef {object} Summary
 * @property {'week'|'month'|'year'} period
 * @property {string} from
 * @property {string} to
 * @property {TypeTotals} income
 * @property {TypeTotals} expense Sin el ahorro.
 * @property {{ total: number }} savings Lo apartado en Ahorro/Inversión.
 * @property {number} balance Ingresos menos gastos y ahorro (lo calcula el frontend).
 * @property {Array<{ date: string, income: number, expense: number }>} timeSeries
 */

/** Gasto que en realidad es plata apartada: igual que en el backend, no cuenta como gasto. */
const SAVINGS_CATEGORY = 'ahorro_inversion';

/** Redondeo a centavos: las sumas de decimales en JS dejan residuos (0.1 + 0.2). */
const cents = (n) => Math.round(n * 100) / 100;

/**
 * Primer y último día de un mes AAAA-MM (lo usan los filtros de transacciones).
 * @param {string} month
 * @returns {{ from: string, to: string }}
 */
export function monthRange(month) {
  return periodRange('month', `${month}-01`);
}

/**
 * Arma `{ total, byCategory }` a partir de un mapa categoría → suma.
 * @param {Map<string|null, number>} sums
 * @returns {TypeTotals}
 */
function toTypeTotals(sums) {
  const total = cents([...sums.values()].reduce((a, b) => a + b, 0));
  const byCategory = [...sums]
    .map(([category, sum]) => ({
      category,
      total: cents(sum),
      percentage: total === 0 ? 0 : Math.round((sum / total) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total);
  return { total, byCategory };
}

/** Calcula el resumen sumando los movimientos del periodo página por página. */
async function computeLocally(period, { from, to }) {
  const sums = { ingreso: new Map(), gasto: new Map() };
  const series = new Map();
  let saved = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, total } = await listTransactions({ from, to, page, pageSize: PAGE_SIZE });
    for (const t of data) {
      if (t.type === 'gasto' && t.category === SAVINGS_CATEGORY) {
        saved = cents(saved + t.amount);
        continue;
      }
      const byType = sums[t.type];
      byType.set(t.category, (byType.get(t.category) ?? 0) + t.amount);
      // En el año la serie va por mes (día 1); en semana y mes, por día.
      const key = period === 'year' ? `${t.date.slice(0, 7)}-01` : t.date;
      const point = series.get(key) ?? { date: key, income: 0, expense: 0 };
      if (t.type === 'ingreso') point.income = cents(point.income + t.amount);
      else point.expense = cents(point.expense + t.amount);
      series.set(key, point);
    }
    if (page * PAGE_SIZE >= total) break;
  }
  return {
    period,
    from,
    to,
    income: toTypeTotals(sums.ingreso),
    expense: toTypeTotals(sums.gasto),
    savings: { total: saved },
    timeSeries: [...series.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * Resumen de un periodo.
 * @param {'week'|'month'|'year'} period
 * @param {string} date Cualquier día del periodo, AAAA-MM-DD.
 * @returns {Promise<Summary>}
 */
export async function getSummary(period, date) {
  let summary;
  try {
    summary = await apiRequest(`/transactions/summary?period=${period}&date=${date}`);
  } catch (err) {
    if (err.code !== 'NOT_FOUND') throw err;
    summary = await computeLocally(period, periodRange(period, date));
  }
  // `?? 0`: si el frontend nuevo sale antes que el backend que manda `savings`. Se normaliza aquí
  // para que ninguna pantalla tenga que repetir el caso.
  const saved = summary.savings?.total ?? 0;
  return {
    ...summary,
    savings: { total: saved },
    balance: cents(summary.income.total - summary.expense.total - saved),
  };
}
