import { formatMoney } from '@/components/transactions/format';

/**
 * @typedef {object} Highlight
 * @property {'budget'|'top'|'balance'} kind Qué dato muestra (define el ícono).
 * @property {'positive'|'caution'|'negative'|'neutral'} tone Color de la tarjeta.
 * @property {string} title Frase corta.
 * @property {string} detail Cifra que la respalda.
 */

/**
 * Datos del mes hasta hoy para Insights mientras no hay un mes de historial (los consejos con IA
 * lo necesitan, REQ-021). Se calculan en el dispositivo con el resumen y los presupuestos, sin IA:
 * el presupuesto más cerca del límite, el mayor gasto y el balance. Sin movimientos, devuelve `[]`.
 *
 * @param {{ summary: import('@/services/summaryService').Summary, budgets: import('@/services/budgetService').Budget[], names: Record<string, string> }} data
 * @returns {Highlight[]}
 */
export function buildMonthHighlights({ summary, budgets, names }) {
  const income = summary.income.total;
  const expense = summary.expense.total;
  if (income === 0 && expense === 0) return [];
  const name = (key) => (key ? (names[key] ?? key) : 'Sin clasificar');
  const highlights = [];

  const tightest = [...budgets].sort((a, b) => b.percentage - a.percentage)[0];
  if (tightest) {
    const percent = `${Math.round(tightest.percentage)} %`;
    if (tightest.percentage >= 100) {
      highlights.push({
        kind: 'budget',
        tone: 'negative',
        title: `Te pasaste en ${name(tightest.category)}`,
        detail: `Llevas ${formatMoney(tightest.consumed)} de ${formatMoney(tightest.amount)}`,
      });
    } else if (tightest.percentage >= 80) {
      highlights.push({
        kind: 'budget',
        tone: 'caution',
        title: `${name(tightest.category)} va al ${percent}`,
        detail: `Te quedan ${formatMoney(tightest.amount - tightest.consumed)}`,
      });
    } else {
      highlights.push({
        kind: 'budget',
        tone: 'positive',
        title: 'Tus presupuestos van bien',
        detail: `El más alto, ${name(tightest.category)}, va al ${percent}`,
      });
    }
  }

  const top = summary.expense.byCategory[0];
  if (top) {
    highlights.push({
      kind: 'top',
      tone: 'neutral',
      title: `Tu mayor gasto: ${name(top.category)}`,
      detail: `${formatMoney(top.total)}, el ${Math.round(top.percentage)} % de tus gastos`,
    });
  }

  if (income === 0) {
    highlights.push({
      kind: 'balance',
      tone: 'neutral',
      title: `Llevas ${formatMoney(expense)} en gastos`,
      detail: 'Registra tus ingresos para ver cuánto te queda',
    });
  } else if (income >= expense) {
    highlights.push({
      kind: 'balance',
      tone: 'positive',
      title: `Te quedan ${formatMoney(income - expense)}`,
      detail: `Entraron ${formatMoney(income)} y gastaste ${formatMoney(expense)}`,
    });
  } else {
    highlights.push({
      kind: 'balance',
      tone: 'negative',
      title: 'Gastaste más de lo que entró',
      detail: `${formatMoney(expense - income)} por encima de tus ingresos`,
    });
  }

  return highlights;
}
