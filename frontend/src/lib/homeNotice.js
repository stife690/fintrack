import { displayLevel } from '@/lib/budgetLevel';
import { NETWORK_LABELS } from '@/lib/cardStyles';
import { dayAndMonth } from '@/lib/moneyPlan';

/** Días antes del pago en los que la tarjeta pasa por encima de un pago pendiente. */
const CARD_SOON_DAYS = 3;

const when = (days) => (days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`);
const cardName = (card) => `${NETWORK_LABELS[card.network] ?? card.name} ••${card.last4}`;

/**
 * El único aviso del inicio en el celular, el más urgente: tarjeta atrasada, presupuesto pasado,
 * tarjeta por vencer, pago pendiente, presupuesto cerca del límite y, por último, la próxima tarjeta.
 *
 * @param {{ cards?: object[], budgets?: object[], pending?: object[], names: Record<string, string>, money: (value: number) => string }} data
 * @returns {{ to: string, title: string, detail: string }|null}
 */
export function pickHomeNotice({ cards = [], budgets = [], pending = [], names, money }) {
  const unpaid = cards.filter((card) => !card.paidThisCycle).sort((a, b) => a.daysToPayment - b.daysToPayment);
  const nextCard = unpaid[0];
  const cardNotice = (title) => ({
    to: `/app/tarjetas/${nextCard.id}`,
    title,
    detail: `Debes ${money(nextCard.used)}`,
  });
  const budgetName = (budget) => names[budget.category] ?? budget.category;

  if (nextCard?.daysToPayment < 0) return cardNotice(`Tu ${cardName(nextCard)} tiene el pago atrasado`);

  const exceeded = budgets.find((budget) => displayLevel(budget.alert) === 'exceeded_100');
  if (exceeded) {
    return {
      to: '/app/presupuestos',
      title: `Te pasaste en ${budgetName(exceeded)}`,
      detail: `Llevas ${money(exceeded.consumed)} de ${money(exceeded.amount)}`,
    };
  }

  if (nextCard?.daysToPayment <= CARD_SOON_DAYS) {
    return cardNotice(`Tu ${cardName(nextCard)} se paga ${when(nextCard.daysToPayment)}`);
  }

  if (pending[0]) {
    return {
      to: '/app/mi-plata',
      title: `${pending[0].name} vence el ${dayAndMonth(pending[0].date)}`,
      detail: money(pending[0].amount),
    };
  }

  const warning = budgets.find((budget) => budget.alert.level === 'warning_80');
  if (warning) {
    return {
      to: '/app/presupuestos',
      title: `${budgetName(warning)} ya casi llega al límite`,
      detail: `Quedan ${money(Math.max(0, warning.amount - warning.consumed))}`,
    };
  }

  return nextCard ? cardNotice(`Tu ${cardName(nextCard)} se paga ${when(nextCard.daysToPayment)}`) : null;
}
