import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Ring from '@/components/charts/Ring';
import { formatMoney } from '@/components/transactions/format';
import { expenseSlices, formatShare } from '@/lib/expenseSlices';
import { cn } from '@/lib/utils';

const MASK = '$ ••••';
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

/** En el centro de la dona cabe poco: de un millón en adelante va abreviado (`$ 1,2 M`). */
const centerMoney = (value) => (value >= 1_000_000 ? `$ ${compact.format(value).replace(/\s*M.*$/, ' M')}` : formatMoney(value));

const sliceColor = (hue) => (hue ? `var(--app-chart-cat-${hue})` : 'var(--app-chart-other)');

/**
 * Dona de gastos por categoría: el total en el centro y al lado cuánto pesa cada una. Toda la tarjeta
 * lleva al detalle de Gastos.
 * @param {object} props
 * @param {{ total: number, byCategory: Array<{ category: string|null, total: number }> }|undefined} props.expense
 *   `undefined` mientras carga.
 * @param {Record<string, string>} props.names
 * @param {boolean} props.hidden Ocultar montos; los porcentajes siguen visibles.
 * @param {string} props.periodLabel Periodo, p. ej. `noviembre`.
 * @param {{ period: string, date: string }} [props.selected] Periodo que abre en Gastos.
 * @param {boolean} [props.large] Dona más grande y montos en la lista, para el computador.
 * @param {string} [props.className]
 */
export default function ExpenseDonut({ expense, names, hidden, periodLabel, selected, large = false, className }) {
  const slices = expense ? expenseSlices(expense.byCategory, names) : [];
  const money = (value) => (hidden ? MASK : formatMoney(value));
  const card = 'rounded-2xl border border-ink/10 bg-surface p-3.5';
  const summary = slices.map((s) => `${s.name} ${formatShare(s.share)}`).join(', ');

  return (
    <section aria-labelledby="gastos-categoria" className={className}>
      <h2 id="gastos-categoria" className="mb-2 text-lg font-semibold tracking-tight">
        Gastos por categoría
      </h2>
      {expense === undefined ? (
        <div className={cn(card, 'flex items-center gap-4')} aria-busy="true">
          <div className={cn('shrink-0 animate-pulse rounded-full bg-ink/5', large ? 'size-40' : 'size-[124px]')} />
          <div className="h-24 flex-1 animate-pulse rounded-xl bg-ink/5" />
        </div>
      ) : slices.length === 0 ? (
        <p className={cn(card, 'text-sm text-ink/70')}>Aún no hay gastos en {periodLabel}.</p>
      ) : (
        <Link
          to="/app/gastos"
          state={selected ? { selected } : undefined}
          aria-label={`Gastos de ${periodLabel}: ${hidden ? 'monto oculto' : formatMoney(expense.total)}. ${summary}. Ver el detalle`}
          className={cn(card, 'relative flex items-center gap-4 pr-7 transition-colors hover:bg-ink/[0.02] active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet', large && 'gap-7 p-5 pr-9')}
        >
          <Ring
            className={large ? 'size-40' : 'size-[124px]'}
            segments={slices.map((s) => ({
              key: s.key,
              value: s.share,
              color: sliceColor(s.hue),
              title: `${s.name}: ${hidden ? '' : `${formatMoney(s.total)} · `}${formatShare(s.share)}`,
            }))}
          >
            <span>
              <span className="block text-xs text-ink/70">Gastos</span>
              <span className={cn('block font-semibold tabular-nums', large ? 'text-lg' : 'text-[15px]')}>
                {hidden ? MASK : centerMoney(expense.total)}
              </span>
            </span>
          </Ring>
          <ul className="min-w-0 flex-1 space-y-2 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: sliceColor(s.hue) }} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {large && <span className="shrink-0 tabular-nums text-ink/70">{money(s.total)}</span>}
                <span className="w-10 shrink-0 text-right font-medium tabular-nums">{formatShare(s.share)}</span>
              </li>
            ))}
          </ul>
          <ChevronRight className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-ink/50" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
