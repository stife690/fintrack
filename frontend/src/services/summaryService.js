/**
 * Totales del mes para el inicio.
 *
 * El contrato define `GET /transactions/summary` (FT-0004). Mientras no esté desplegado, la API
 * responde 404 y los totales se calculan aquí sumando los movimientos del mes. Cuando el endpoint
 * exista se usa solo, sin cambiar nada en las pantallas.
 */
import { apiRequest } from '@/lib/apiRequest';
import { listTransactions } from '@/services/transactionService';

/** Tope de seguridad del cálculo local: 20 páginas × 100 = 2.000 movimientos en un mes. */
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

/**
 * Primer y último día de un mes AAAA-MM.
 * @param {string} month
 * @returns {{ from: string, to: string }}
 */
export function monthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate(); // día 0 del mes siguiente = último del actual
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** Suma los movimientos del mes página por página. */
async function computeLocally({ from, to }) {
  let income = 0;
  let expense = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, total } = await listTransactions({ from, to, page, pageSize: PAGE_SIZE });
    for (const t of data) {
      if (t.type === 'ingreso') income += t.amount;
      else expense += t.amount;
    }
    if (page * PAGE_SIZE >= total) break;
  }
  // Redondeo a centavos: las sumas de decimales en JS dejan residuos (0.1 + 0.2).
  return { income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100 };
}

/**
 * Ingresos, gastos y balance de un mes.
 * @param {string} month AAAA-MM
 * @returns {Promise<{ income: number, expense: number, balance: number }>}
 */
export async function getMonthTotals(month) {
  const range = monthRange(month);
  let totals;
  try {
    const summary = await apiRequest(`/transactions/summary?period=month&date=${range.from}`);
    totals = { income: summary.income.total, expense: summary.expense.total };
  } catch (err) {
    if (err.code !== 'NOT_FOUND') throw err;
    totals = await computeLocally(range);
  }
  return { ...totals, balance: Math.round((totals.income - totals.expense) * 100) / 100 };
}
