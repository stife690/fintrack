import { Link } from 'react-router-dom';
import CategoryIcon from '@/components/categories/CategoryIcon';
import { formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { cn } from '@/lib/utils';

/**
 * Un movimiento en una lista: ícono, descripción, categoría (y el día, si se pasa) y monto con signo.
 * Toca para abrir su detalle; el movimiento va en el estado de la navegación para abrirlo sin conexión.
 * @param {{ transaction: import('@/services/transactionService').Transaction, names: Record<string, string>, hidden?: boolean, day?: string, withDay?: boolean }} props `withDay`: agrega el día relativo. `icon`: muestra el ícono también en el celular. `fresh`: recién agregado, entra resaltado. `syncStatus`: tiene un cambio sin sincronizar.
 */
export default function MovementRow({ transaction: t, names, hidden = false, day, withDay = false, icon = false, fresh = false, syncStatus }) {
  const income = t.type === 'ingreso';
  const category = t.category ? (names[t.category] ?? t.category) : 'Sin clasificar';
  const dayText = day ?? (withDay ? formatRelativeDay(t.date) : undefined);
  return (
    <li className={fresh ? 'motion-safe:animate-row-in' : undefined}>
      <Link
        to={`/app/transacciones/${t.id}`}
        state={{ transaction: t }}
        className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-ink/5 active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span className={icon ? undefined : 'max-md:hidden'}>
          <CategoryIcon category={t.category} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{t.description}</span>
          <span className="block truncate text-sm text-ink/60">{dayText ? `${category} · ${dayText}` : category}</span>
          {syncStatus && (
            <span className={cn('block text-xs font-medium', syncStatus === 'rejected' ? 'text-negative' : 'text-brand')}>
              {syncStatus === 'rejected' ? 'No se pudo sincronizar' : 'Pendiente de sincronizar'}
            </span>
          )}
        </span>
        <span className={cn('shrink-0 font-semibold tabular-nums', income ? 'text-positive' : 'text-ink')}>
          <span className="sr-only">{income ? 'Ingreso de ' : 'Gasto de '}</span>
          {hidden ? '••••' : `${income ? '+' : '−'}${formatMoney(t.amount)}`}
        </span>
      </Link>
    </li>
  );
}
