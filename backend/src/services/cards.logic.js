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
 * @param {{ card: { limit: number, debtBase: number, paymentDay: number }, purchases: number,
 *   payments: Array<{ date: string, amount: number }>, today: string }} input
 * @returns {{ used: number, available: number, nextPaymentDate: string, daysToPayment: number, paidThisCycle: boolean }}
 */
export function cardState({ card, purchases, payments, today }) {
  const paid = payments.reduce((acc, p) => acc + p.amount, 0);
  const used = Math.max(0, cents(card.debtBase + purchases - paid));
  const { previous, next } = dueDates(card.paymentDay, today);
  const paidThisCycle = payments.some((p) => p.date > previous);
  const nextPaymentDate = paidThisCycle
    ? dateInMonth(shiftMonth(next.slice(0, 7), 1), card.paymentDay)
    : next;
  const daysToPayment = Math.round((Date.parse(nextPaymentDate) - Date.parse(today)) / 86_400_000);
  return {
    used,
    available: cents(card.limit - used),
    nextPaymentDate,
    daysToPayment,
    paidThisCycle,
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
