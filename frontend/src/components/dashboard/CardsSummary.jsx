import { CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MASK } from '@/components/dashboard/BalanceCard';
import { formatMoney } from '@/components/transactions/format';

/** "hoy", "mañana" o "en N días" (mismas palabras que `paymentText`). */
const when = (days) => (days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`);

/**
 * Una línea bajo el balance con lo que se debe en tarjetas y cuándo toca el próximo pago.
 * No renderiza nada sin tarjetas.
 * @param {{ cards?: Array<{ used: number, daysToPayment: number, paidThisCycle: boolean }>, hidden: boolean }} props
 */
export default function CardsSummary({ cards, hidden }) {
  if (!cards?.length) return null;
  const owed = cards.reduce((sum, card) => sum + card.used, 0);
  const pending = cards.filter((card) => !card.paidThisCycle);
  const soonest = Math.min(...pending.map((card) => card.daysToPayment));
  const tail =
    pending.length === 0
      ? 'todas pagadas este mes'
      : soonest < 0
        ? 'tienes un pago atrasado'
        : `próximo pago ${when(soonest)}`;

  return (
    <Link
      to="/app/tarjetas"
      className="flex min-h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-4 py-2 text-sm text-ink/70"
    >
      <CreditCard className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Debes <span className="font-semibold tabular-nums text-ink">{hidden ? MASK : formatMoney(owed)}</span> en
        tarjetas · {tail}
      </span>
    </Link>
  );
}
