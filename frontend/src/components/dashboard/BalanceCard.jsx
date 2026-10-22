import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';
import { cn } from '@/lib/utils';

const MASK = '$ ••••••';

/**
 * Monto que se puede ocultar. Mientras carga muestra un bloque gris del mismo alto.
 * @param {{ value: number|undefined, hidden: boolean, className?: string }} props
 */
function Amount({ value, hidden, className }) {
  if (value === undefined) {
    return <span className={cn('inline-block h-[1em] w-32 animate-pulse rounded-md bg-current opacity-20', className)} />;
  }
  return <span className={cn('tabular-nums', className)}>{hidden ? MASK : formatMoney(value)}</span>;
}

/**
 * Total del periodo (ingresos o gastos) en una tarjeta blanca que se monta sobre la franja violeta.
 * @param {{ label: string, value?: number, hidden: boolean, positive?: boolean }} props
 */
function Total({ label, value, hidden, positive = false }) {
  const Icon = positive ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-surface p-4 shadow-[0_8px_24px_-12px_rgb(22_20_31/0.25)]">
      <p className="flex items-center gap-1.5 text-sm text-ink/60">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-6 place-items-center rounded-full',
            positive ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative',
          )}
        >
          <Icon className="size-3.5" />
        </span>
        {label}
      </p>
      <p className="mt-1.5 truncate text-base font-semibold sm:text-xl">
        <Amount value={value} hidden={hidden} />
      </p>
    </div>
  );
}

/**
 * Tarjeta principal del inicio: balance del periodo elegido en la franja violeta, y debajo los ingresos
 * y gastos. El ojo oculta los montos (se recuerda en el dispositivo).
 *
 * @param {object} props
 * @param {string} props.periodLabel Periodo legible, p. ej. `octubre`, `esta semana` o `2026`.
 * @param {{ income: number, expense: number, balance: number }|undefined} props.totals `undefined` mientras carga.
 * @param {string} [props.note] Reemplaza "Calculando…" cuando no hay totales que esperar (p. ej. sin conexión).
 * @param {boolean} props.hidden
 * @param {() => void} props.onToggleHidden
 */
export default function BalanceCard({ periodLabel, totals, note, hidden, onToggleHidden }) {
  const negative = totals && totals.balance < 0;
  return (
    <section aria-labelledby="balance-title" className="relative">
      <div className="relative overflow-hidden rounded-3xl bg-violet px-6 pb-14 pt-6 text-white md:px-8 md:pt-7">
        {/* Dos círculos de luz: dan profundidad a la franja sin competir con el número. */}
        <span aria-hidden="true" className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -right-4 top-16 size-28 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between gap-4">
          <h2 id="balance-title" className="text-sm font-medium text-white/80">
            Balance de {periodLabel}
          </h2>
          <button
            type="button"
            onClick={onToggleHidden}
            aria-pressed={hidden}
            aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            className="-m-2 grid size-10 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white"
          >
            {hidden ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>

        <p className="relative mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          {negative && !hidden && <span className="sr-only">Negativo: </span>}
          <Amount value={totals?.balance} hidden={hidden} />
        </p>
        <p className="relative mt-2 text-sm text-white/75">
          {totals === undefined
            ? (note ?? 'Calculando…')
            : negative
              ? 'En este periodo has gastado más de lo que te ha entrado.'
              : 'Lo que te ha entrado menos lo que has gastado.'}
        </p>
      </div>

      <div className="relative -mt-9 flex gap-3 px-3 md:gap-4 md:px-5">
        <Total label="Ingresos" value={totals?.income} hidden={hidden} positive />
        <Total label="Gastos" value={totals?.expense} hidden={hidden} />
      </div>
    </section>
  );
}
