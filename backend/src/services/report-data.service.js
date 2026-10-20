import { listCategories } from '../repositories/categories.repository.js';
import { listForExport } from '../repositories/transactions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import * as budgets from './budgets.service.js';

const DEFAULT_TIMEZONE = 'America/Bogota';
const TOP_EXPENSES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Redondea a centavos: las sumas de decimales en JS dejan residuos (0.1 + 0.2).
 * @param {number} n
 * @returns {number}
 */
const cents = (n) => Math.round(n * 100) / 100;

/**
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @returns {boolean} `true` si el rango es un mes completo (del día 1 al último día).
 */
export function isWholeMonth(from, to) {
  const [year, month] = from.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // día 0 del mes siguiente
  return from.endsWith('-01') && to === `${from.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
}

/**
 * Días del rango, ambos incluidos. Las fechas se tratan en UTC para que no influya el horario.
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @returns {number}
 */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * Agrupa movimientos por categoría: total, número de movimientos y participación en el total.
 * @param {Array<{ categoryName: string|null, amount: number }>} rows
 * @param {number} total
 * @returns {Array<{ name: string, amount: number, count: number, share: number }>} De mayor a menor.
 */
function byCategory(rows, total) {
  const groups = new Map();
  for (const row of rows) {
    const name = row.categoryName ?? 'Sin clasificar';
    const group = groups.get(name) ?? { name, amount: 0, count: 0 };
    group.amount += row.amount;
    group.count += 1;
    groups.set(name, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, amount: cents(g.amount), share: total > 0 ? g.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Calcula todas las cifras del reporte a partir de los movimientos del periodo.
 * Es una función pura (sin base de datos), así se prueba con datos inventados.
 *
 * @param {Awaited<ReturnType<typeof listForExport>>} rows Movimientos en orden cronológico.
 * @param {{ from: string, to: string, today: string }} period `today` en la zona del usuario: el
 *   promedio diario se calcula solo sobre los días que ya pasaron.
 * @returns {object} Totales, categorías, top de gastos y meses (ver `buildReport`).
 */
export function summarize(rows, { from, to, today }) {
  const expenses = rows.filter((r) => r.type === 'gasto');
  const incomes = rows.filter((r) => r.type === 'ingreso');
  const income = cents(incomes.reduce((sum, r) => sum + r.amount, 0));
  const expense = cents(expenses.reduce((sum, r) => sum + r.amount, 0));
  const balance = cents(income - expense);

  // En un periodo que incluye días futuros ("este mes" a mitad de mes) se promedia hasta hoy.
  const lastCountedDay = to < today ? to : today;
  const daysElapsed = Math.max(1, from <= lastCountedDay ? daysBetween(from, lastCountedDay) : 1);

  const months = new Map();
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const month = months.get(key) ?? { month: key, income: 0, expense: 0 };
    month[row.type === 'ingreso' ? 'income' : 'expense'] += row.amount;
    months.set(key, month);
  }

  return {
    totals: {
      income,
      expense,
      balance,
      // Qué parte de lo que entró no se gastó. Sin ingresos no tiene sentido (null).
      savingsRate: income > 0 ? balance / income : null,
      dailyAverageExpense: cents(expense / daysElapsed),
      daysElapsed,
      count: rows.length,
      expenseCount: expenses.length,
      incomeCount: incomes.length,
    },
    expenseByCategory: byCategory(expenses, expense),
    incomeByCategory: byCategory(incomes, income),
    topExpenses: [...expenses]
      .sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date))
      .slice(0, TOP_EXPENSES),
    byMonth: [...months.values()].map((m) => ({
      month: m.month,
      income: cents(m.income),
      expense: cents(m.expense),
      balance: cents(m.income - m.expense),
    })),
  };
}

/**
 * Fecha de hoy (AAAA-MM-DD) en una zona horaria; si la zona no es válida, la de Colombia.
 * @param {string} timeZone
 * @returns {string}
 */
function todayIn(timeZone) {
  const format = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  try {
    return format(timeZone);
  } catch {
    return format(DEFAULT_TIMEZONE);
  }
}

/**
 * Datos completos del reporte de un periodo, compartidos por el Excel y el PDF (FT-0012).
 * Si el periodo es un mes completo incluye los presupuestos de ese mes.
 * @param {string} userId
 * @param {{ from: string, to: string }} period Fechas AAAA-MM-DD ya validadas.
 * @returns {Promise<object|null>} `null` si no hay movimientos en el periodo.
 */
export async function buildReport(userId, { from, to }) {
  const rows = await listForExport({ userId, from, to });
  if (rows.length === 0) return null;

  const user = await findUserById(userId);
  const timeZone = user?.timezone ?? DEFAULT_TIMEZONE;
  const today = todayIn(timeZone);
  const summary = summarize(rows, { from, to, today });

  let monthBudgets = [];
  if (isWholeMonth(from, to)) {
    const [list, categories] = await Promise.all([budgets.list(userId, from.slice(0, 7)), listCategories()]);
    const names = new Map(categories.map((c) => [c.key, c.name]));
    monthBudgets = list.map((b) => ({
      category: names.get(b.category) ?? b.category,
      limit: b.amount,
      spent: b.consumed,
      available: cents(b.amount - b.consumed),
      usage: b.amount > 0 ? b.consumed / b.amount : 0,
      level: b.alert.level,
    }));
  }

  return {
    period: { from, to, wholeMonth: isWholeMonth(from, to) },
    owner: { name: user?.name ?? null, email: user?.email ?? '' },
    generatedOn: today,
    ...summary,
    budgets: monthBudgets,
    rows,
  };
}
