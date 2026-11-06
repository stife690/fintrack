import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Bell, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { MASK } from '@/components/dashboard/BalanceCard';
import ExpenseDonut from '@/components/dashboard/ExpenseDonut';
import { CIRCLES } from '@/components/dashboard/QuickActions';
import CircleActions from '@/components/common/CircleActions';
import DashboardEmpty from '@/components/dashboard/DashboardEmpty';
import { useNotifications } from '@/components/layout/NotificationsProvider';
import Panel from '@/components/layout/Panel';
import MoneyInvite from '@/components/money/MoneyInvite';
import MoneySetupLink from '@/components/money/MoneySetupLink';
import MovementRow from '@/components/transactions/MovementRow';
import { formatMoney } from '@/components/transactions/format';
import useFreshIds from '@/hooks/useFreshIds';
import { displayLevel } from '@/lib/budgetLevel';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { pickHomeNotice } from '@/lib/homeNotice';
import { cn } from '@/lib/utils';

const RECENT = 3;
const BUDGETS = 3;
const BAR = { none: 'bg-positive', warning_80: 'bg-caution', exceeded_100: 'bg-negative' };
const PERCENT_TEXT = { none: 'text-ink/60', warning_80: 'font-semibold text-caution', exceeded_100: 'font-semibold text-negative' };
const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Bloque gris mientras carga un monto. */
const Skeleton = ({ className }) => (
  <span className={cn('inline-block animate-pulse rounded-md bg-current opacity-20', className)} />
);

/** Ingresos o gastos del mes, sobre la franja morada. Lleva a su detalle. */
function Total({ label, value, money, to, positive = false }) {
  const Icon = positive ? ArrowDownLeft : ArrowUpRight;
  return (
    <Link
      to={to}
      className="min-w-0 rounded-2xl border border-ink/10 bg-surface p-3.5 transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-violet motion-safe:active:scale-[0.98]"
    >
      <span className="flex items-center gap-1.5 text-sm text-ink/70">
        <Icon className={cn('size-4', positive ? 'text-positive' : 'text-negative')} strokeWidth={2.25} aria-hidden="true" />
        {label}
      </span>
      <span className="mt-1.5 block truncate text-lg font-semibold tabular-nums">
        {value === undefined ? <Skeleton className="h-[1em] w-24" /> : money(value)}
      </span>
      <span className="sr-only">, ver el detalle</span>
    </Link>
  );
}

/** Título de una sección con su enlace a la derecha. */
function SectionTitle({ id, to, children }) {
  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {children}
      </h2>
      <Link to={to} className="py-3 text-sm font-medium text-brand">
        Ver todos
      </Link>
    </div>
  );
}

/**
 * Inicio en el celular: lo esencial y nada más. El saldo, los ingresos y gastos del mes, los accesos,
 * un solo aviso, los últimos movimientos, los gastos por categoría y cómo van los presupuestos. Lo demás está a un toque.
 *
 * @param {object} props
 * @param {number|null|undefined} props.balance Saldo; `undefined` mientras carga.
 * @param {{ income: number, expense: number }|undefined} props.totals Del mes actual.
 * @param {object[]|undefined} props.budgets
 * @param {object|null|undefined} props.expense Gastos del mes por categoría; `undefined` mientras carga, `null` si no se pudieron traer.
 * @param {object[]|undefined} props.cards
 * @param {object[]|undefined} props.recent
 * @param {object[]} [props.pending] Pagos pendientes de Mi plata.
 * @param {string} [props.recentError]
 * @param {Record<string, string>} props.names
 * @param {string} props.monthLabel Mes actual, p. ej. `noviembre`.
 * @param {boolean} props.empty Aún no tiene movimientos.
 * @param {boolean} props.welcomePending
 * @param {boolean} props.setupPending
 * @param {() => void} props.onWelcomeDone
 * @param {boolean} props.hidden
 * @param {() => void} props.onToggleHidden
 */
export default function MobileHome({
  balance,
  totals,
  expense,
  budgets,
  cards,
  recent,
  pending = [],
  recentError,
  names,
  monthLabel,
  empty,
  welcomePending,
  setupPending,
  onWelcomeDone,
  hidden,
  onToggleHidden,
}) {
  const { user } = useAuth();
  const { unread } = useNotifications();
  const fresh = useFreshIds(recent);
  const money = (value) => (hidden ? MASK : formatMoney(value));
  const name = getDisplayName(user);
  const notice = pickHomeNotice({ cards, budgets, pending, names, money });
  const topBudgets = budgets ? [...budgets].sort((a, b) => b.percentage - a.percentage).slice(0, BUDGETS) : [];
  // Al anotar algo se recalcula sin borrar la dona, para que la pantalla no salte.
  const lastExpense = useRef();
  if (expense) lastExpense.current = expense;
  const shownExpense = expense === undefined ? lastExpense.current : expense;

  return (
    <div className="-mt-2 flex flex-col">
      <div className="relative -mx-4 overflow-hidden bg-violet px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
        {/* Dos círculos de luz: dan profundidad a la franja sin competir con el número. */}
        <span aria-hidden="true" className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -right-4 top-16 size-28 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <Link
              to="/app/cuenta"
              aria-label="Tu cuenta"
              className="relative grid size-11 place-items-center rounded-full bg-white/20 font-semibold focus-visible:outline-2 focus-visible:outline-white"
            >
              <span aria-hidden="true">{getInitial(user)}</span>
            </Link>
            <div className="flex items-center gap-1">
              <Link
                to="/app/notificaciones"
                aria-label={unread === 0 ? 'Notificaciones' : `Notificaciones, ${unread} sin leer`}
                className="relative grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
              >
                <Bell className="size-[22px]" aria-hidden="true" />
                {unread > 0 && (
                  <span aria-hidden="true" className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-white px-1 text-[11px] font-bold leading-[18px] text-brand">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={onToggleHidden}
                aria-pressed={hidden}
                aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
                className="grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
              >
                {hidden ? <EyeOff className="size-[22px]" aria-hidden="true" /> : <Eye className="size-[22px]" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <p className="mt-4">{name ? `Hola, ${name}` : 'Hola'}</p>
          <Link to="/app/mi-plata" className="mt-4 flex items-end justify-between gap-3 focus-visible:outline-2 focus-visible:outline-white">
            <span className="min-w-0">
              <span className="block text-sm">Saldo disponible</span>
              <span className="mt-1 block truncate text-[42px] font-semibold leading-tight tracking-tight tabular-nums">
                {balance === undefined ? <Skeleton className="h-[0.9em] w-52" /> : money(balance ?? 0)}
              </span>
              <span className="sr-only">, ver Mi plata</span>
            </span>
            <ChevronRight className="mb-2 size-6 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="relative -mt-10 grid grid-cols-2 gap-3">
        <Total label="Ingresos" to="/app/ingresos" value={totals?.income} money={money} positive />
        <Total label="Gastos" to="/app/gastos" value={totals?.expense} money={money} />
      </div>
      <p className="mt-2 text-[13px] text-ink/70 first-letter:uppercase">De {monthLabel}</p>

      <CircleActions label="Accesos" actions={CIRCLES} className="mt-5" />

      {notice ? (
        <Link
          to={notice.to}
          className="mt-5 flex items-center gap-3 rounded-2xl bg-brand-soft p-3.5 focus-visible:outline-2 focus-visible:outline-violet"
        >
          <Bell className="size-[22px] shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[15px]">
            <span className="block font-semibold">{notice.title}</span>
            {notice.detail}
          </span>
          <ChevronRight className="size-[18px] shrink-0 text-ink/60" aria-hidden="true" />
        </Link>
      ) : welcomePending ? (
        <div className="mt-5">
          <MoneyInvite onDone={onWelcomeDone} />
        </div>
      ) : setupPending ? (
        <div className="mt-5">
          <MoneySetupLink />
        </div>
      ) : null}

      {empty ? (
        <div className="mt-6">
          <DashboardEmpty />
        </div>
      ) : (
        <>
          <section aria-labelledby="ultimos" className="mt-6">
            <SectionTitle id="ultimos" to="/app/mi-plata">
              Últimos movimientos
            </SectionTitle>
            <Panel className="mt-1 px-3.5 py-0 md:p-0">
              {recentError ? (
                <p className="py-4 text-sm text-negative">{recentError}</p>
              ) : recent === undefined ? (
                <ul className="space-y-3 py-3" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="h-11 animate-pulse rounded-xl bg-ink/5" />
                  ))}
                </ul>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {recent.slice(0, RECENT).map((transaction) => (
                    <MovementRow key={transaction.id} transaction={transaction} names={names} hidden={hidden} withDay fresh={fresh.has(transaction.id)} />
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          {shownExpense !== null && (
            <ExpenseDonut className="mt-5" expense={shownExpense} names={names} hidden={hidden} periodLabel={monthLabel} />
          )}

          {topBudgets.length > 0 && (
            <section aria-labelledby="presupuestos-inicio" className="mt-3">
              <SectionTitle id="presupuestos-inicio" to="/app/presupuestos">
                Presupuestos
              </SectionTitle>
              <Panel className="mt-1 space-y-3.5 p-3.5 md:p-3.5">
                {topBudgets.map((budget) => {
                  const label = names[budget.category] ?? budget.category;
                  const level = displayLevel(budget.alert);
                  return (
                    <div key={budget.id}>
                      <div className="flex justify-between text-[15px]">
                        <span className="font-medium">{label}</span>
                        <span className={cn('tabular-nums', PERCENT_TEXT[level])}>{percent.format(budget.percentage)} %</span>
                      </div>
                      <div
                        role="meter"
                        aria-label={`Consumo de ${label}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(budget.percentage, 100)}
                        className="mt-1.5 h-1.5 rounded-full bg-ink/10"
                      >
                        <div className={cn('h-full origin-left rounded-full motion-safe:animate-bar-in motion-safe:transition-[width] motion-safe:duration-500', BAR[level])} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </Panel>
            </section>
          )}
        </>
      )}
    </div>
  );
}
