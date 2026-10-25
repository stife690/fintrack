import { Link } from 'react-router-dom';
import CategoryIcon from '@/components/categories/CategoryIcon';
import Panel from '@/components/layout/Panel';
import { formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { cn } from '@/lib/utils';

/**
 * Últimos movimientos del usuario, con ícono de categoría, día y monto con signo.
 * @param {object} props
 * @param {import('@/services/transactionService').Transaction[]|undefined} props.transactions `undefined` mientras carga.
 * @param {Record<string, string>} props.names Nombre por clave de categoría.
 * @param {boolean} props.hidden Ocultar montos.
 * @param {string} [props.error]
 */
export default function RecentTransactions({ transactions, names, hidden, error }) {
  return (
    <Panel aria-labelledby="recent-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="recent-title" className="text-lg font-semibold tracking-tight">
          Últimos movimientos
        </h2>
        <Link to="/app/transacciones" className="text-sm font-medium text-brand hover:underline">
          Ver todo
        </Link>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-negative">{error}</p>
      ) : transactions === undefined ? (
        <ul className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl bg-ink/5" />
          ))}
        </ul>
      ) : transactions.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-ink/60">Aún no tienes movimientos. Registra tu primer gasto o ingreso.</p>
          <Link
            to="/app/transacciones?nuevo=gasto"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-brand-soft px-4 text-sm font-medium text-brand"
          >
            Registrar movimiento
          </Link>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-ink/10">
          {transactions.map((t) => {
            const income = t.type === 'ingreso';
            return (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <CategoryIcon category={t.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.description}</p>
                  <p className="truncate text-sm text-ink/60">
                    {t.category ? (names[t.category] ?? t.category) : 'Sin clasificar'} · {formatRelativeDay(t.date)}
                  </p>
                </div>
                <p className={cn('shrink-0 font-semibold tabular-nums', income ? 'text-positive' : 'text-ink')}>
                  <span className="sr-only">{income ? 'Ingreso de ' : 'Gasto de '}</span>
                  {hidden ? '••••' : `${income ? '+' : '−'}${formatMoney(t.amount)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
