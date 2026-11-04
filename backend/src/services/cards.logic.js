import { shiftMonth } from './analytics.service.js';
import { dateInMonth } from './money-plan.service.js';

export const NETWORKS = ['visa', 'mastercard', 'amex', 'otra'];

/** Niveles válidos de cada franquicia. */
export const TIERS = {
  visa: ['clasica', 'gold', 'platinum', 'black'],
  mastercard: ['clasica', 'gold', 'platinum', 'black'],
  amex: ['green', 'blue', 'gold', 'platinum'],
  otra: ['clasica'],
};

export const MAX_INSTALLMENTS = 48;

const cents = (n) => Math.round(n * 100) / 100;

/**
 * Fechas de pago que rodean a hoy. Si hoy es día de pago, ese es el próximo.
 * @param {number} paymentDay 1-31
 * @param {string} today AAAA-MM-DD
 * @returns {{ previous: string, next: string }}
 */
export function dueDates(paymentDay, today) {
  const month = today.slice(0, 7);
  const thisMonth = dateInMonth(month, paymentDay);
  const nextMonth = thisMonth >= today ? month : shiftMonth(month, 1);
  return {
    previous: dateInMonth(shiftMonth(nextMonth, -1), paymentDay),
    next: dateInMonth(nextMonth, paymentDay),
  };
}

/**
 * El vencimiento del mes siguiente a `due` (respeta el día 31 = último día).
 * @param {string} due AAAA-MM-DD
 * @param {number} paymentDay
 * @returns {string}
 */
const nextDue = (due, paymentDay) => dateInMonth(shiftMonth(due.slice(0, 7), 1), paymentDay);

/**
 * Estado de la tarjeta. Tres cosas separadas:
 * - Montos: lo usado solo cuenta los pagos posteriores a la base (`afterBase`).
 * - Ciclo: con TODOS los pagos, sin importar la base. Cada pago paga el primer vencimiento desde la
 *   creación cuya ventana (vencimiento anterior, vencimiento] ya abrió y que siga sin pagar o que lo
 *   cubra a tiempo; así un pago tardío salda el mes atrasado y no el siguiente.
 * - Extracto: se ignora cuando su fecha límite es anterior al próximo pago o lo pagado desde la base
 *   (la base se fija al darlo) ya lo cubre.
 * @param {{ card: { limit: number, debtBase: number, paymentDay: number, createdOn: string,
 *   statementTotal?: number|null, statementDueDate?: string|null }, purchases: number,
 *   payments: Array<{ date: string, amount: number, afterBase: boolean }>, today: string }} input
 * @returns {{ used: number, available: number, nextPaymentDate: string, daysToPayment: number,
 *   paidThisCycle: boolean, paidDueDate: string|null, paidAmount: number,
 *   statementTotal: number|null, statementDueDate: string|null }}
 */
export function cardState({ card, purchases, payments, today }) {
  const sum = (list) => cents(list.reduce((acc, p) => acc + p.amount, 0));
  const paidSinceBase = sum(payments.filter((p) => p.afterBase));
  const used = Math.max(0, cents(card.debtBase + purchases - paidSinceBase));

  const { next } = dueDates(card.paymentDay, today);
  const cycles = [];
  const first = dueDates(card.paymentDay, card.createdOn).next;
  for (let due = first; due <= next; due = nextDue(due, card.paymentDay)) {
    cycles.push({
      opens: dateInMonth(shiftMonth(due.slice(0, 7), -1), card.paymentDay),
      due,
      paid: [],
    });
  }
  for (const p of [...payments].sort((a, b) => a.date.localeCompare(b.date))) {
    const c = cycles.find((x) => p.date > x.opens && (p.date <= x.due || x.paid.length === 0));
    c?.paid.push(p);
  }
  const nextPaymentDate =
    cycles.find((c) => c.paid.length === 0)?.due ?? nextDue(next, card.paymentDay);
  const lastPaid = cycles.findLast((c) => c.paid.length > 0);

  const statementGone =
    (Boolean(card.statementDueDate) && card.statementDueDate < nextPaymentDate) ||
    (typeof card.statementTotal === 'number' && paidSinceBase >= card.statementTotal);
  return {
    used,
    available: cents(card.limit - used),
    nextPaymentDate,
    daysToPayment: Math.round((Date.parse(nextPaymentDate) - Date.parse(today)) / 86_400_000),
    paidThisCycle: nextPaymentDate > next,
    paidDueDate: lastPaid?.due ?? null,
    paidAmount: lastPaid ? sum(lastPaid.paid) : 0,
    statementTotal: statementGone ? null : (card.statementTotal ?? null),
    statementDueDate: statementGone ? null : (card.statementDueDate ?? null),
  };
}

/**
 * Ajuste con lo que dice el banco. La diferencia lleva signo: positiva si el banco cobra más.
 * @param {{ used: number, limit: number, available: number }} input
 * @returns {{ difference: number, newDebtBase: number }}
 */
export function bankAdjustment({ used, limit, available }) {
  const difference = cents(limit - available - used);
  return { difference, newDebtBase: cents(used + difference) };
}
