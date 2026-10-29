import { useEffect, useMemo, useState } from 'react';
import BalanceCard from '@/components/dashboard/BalanceCard';
import BudgetOverview, { BudgetAlert } from '@/components/dashboard/BudgetOverview';
import DashboardEmpty from '@/components/dashboard/DashboardEmpty';
import ExpenseByCategory from '@/components/dashboard/ExpenseByCategory';
import IncomeExpenseChart from '@/components/dashboard/IncomeExpenseChart';
import PeriodSelector from '@/components/dashboard/PeriodSelector';
import QuickActions from '@/components/dashboard/QuickActions';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { currentMonth } from '@/components/budgets/month';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/auth/AuthContext';
import useAsync from '@/hooks/useAsync';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { getDisplayName } from '@/lib/displayName';
import { SYNC_EVENT, listCached, listPending } from '@/offline/sync';
import { periodLabel, todayIso } from '@/lib/period';
import { listBudgets } from '@/services/budgetService';
import { getSummary } from '@/services/summaryService';
import { getCategories, listTransactions } from '@/services/transactionService';

const RECENT_COUNT = 5;

/** `octubre` a partir de `2026-10`. */
function monthName(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
}

/**
 * Página privada `/app`: selector de periodo y balance de ese periodo (FT-0004), accesos rápidos, alertas y resumen de presupuestos
 * (FT-0005) y últimos movimientos. Cada bloque carga por separado: si uno falla, los demás se ven.
 * Los presupuestos siempre son del mes actual: el selector de periodo solo cambia el balance
 * y los gráficos de ingresos/gastos y gastos por categoría.
 * Sin ningún movimiento, el balance y los gráficos se reemplazan por un estado vacío (FT-0004).
 * Sin conexión, los últimos movimientos salen de la copia del dispositivo (FT-0009) y el balance y los
 * presupuestos avisan que se actualizan al volver internet; al reconectar, todo se recarga.
 */
export default function Dashboard() {
  usePageTitle('Inicio');
  const { user } = useAuth();
  const [hidden, toggleHidden] = useHiddenAmounts();
  const online = useOnlineStatus();
  const offlineNote = online ? undefined : 'Sin conexión: se actualiza al volver internet.';
  const month = currentMonth();
  const label = monthName(month);

  // Periodo elegido en el selector. Arranca en el mes actual.
  const [selected, setSelected] = useState({ period: 'month', date: todayIso() });
  const summary = useAsync(() => getSummary(selected.period, selected.date), [selected.period, selected.date, online]);
  // Mientras carga otro periodo se muestra el "cargando", no los números del periodo anterior.
  const current = summary.loading ? undefined : summary.data;
  const totals = current && {
    income: current.income.total,
    expense: current.expense.total,
    balance: current.balance,
  };

  const budgets = useAsync(() => listBudgets(month), [month, online]);
  const recent = useAsync(
    () =>
      listTransactions({ page: 1, pageSize: RECENT_COUNT }).catch((err) => {
        if (err.code !== 'NETWORK_ERROR') throw err;
        return listCached({ page: 1, pageSize: RECENT_COUNT });
      }),
    [online],
  );
  const categories = useAsync(getCategories, []);

  const names = useMemo(() => {
    const all = categories.data ? [...categories.data.expense, ...categories.data.income] : [];
    return Object.fromEntries(all.map((c) => [c.key, c.name]));
  }, [categories.data]);

  // Movimientos guardados sin conexión que aún no llegan al servidor (FT-0009).
  const [pending, setPending] = useState(0);
  const { reload: reloadRecent } = recent;
  const { reload: reloadSummary } = summary;
  useEffect(() => {
    const onSync = ({ detail }) => {
      setPending(detail.pending);
      // Lo sincronizado ya está en el servidor: se recargan el balance y los últimos movimientos.
      if (detail.synced?.length) {
        reloadRecent();
        reloadSummary();
      }
    };
    listPending().then((ops) => setPending(ops.length));
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [reloadRecent, reloadSummary]);

  const name = getDisplayName(user);
  // `total` cuenta todos los movimientos del usuario, no solo los de la página pedida.
  // Si hay pendientes offline el usuario ya registró algo: no se le dice que no tiene movimientos.
  // Sin conexión la copia local puede estar vacía aunque el servidor tenga datos: no se afirma que no hay.
  const empty = online && recent.data?.total === 0 && pending === 0;

  return (
    <>
      <PageHeader
        title={name ? `Hola, ${name}` : 'Hola'}
        description={empty ? 'Te damos la bienvenida a FinTrack.' : `Así va tu ${label}.`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {empty ? (
            <DashboardEmpty />
          ) : (
            <>
              <PeriodSelector period={selected.period} date={selected.date} onChange={setSelected} />
              <BalanceCard
                periodLabel={periodLabel(selected.period, selected.date)}
                totals={totals}
                note={offlineNote}
                hidden={hidden}
                onToggleHidden={toggleHidden}
              />
              {summary.error && online && (
                <p role="alert" className="-mt-2 text-sm text-negative">
                  No pudimos calcular el balance: {summary.error}{' '}
                  <button type="button" className="underline" onClick={summary.reload}>
                    Reintentar
                  </button>
                </p>
              )}
              <QuickActions
                names={names}
                onSaved={() => {
                  reloadRecent();
                  reloadSummary();
                  budgets.reload();
                }}
              />
              {budgets.data && <BudgetAlert budgets={budgets.data} names={names} />}
              <IncomeExpenseChart
                period={selected.period}
                date={selected.date}
                timeSeries={current?.timeSeries}
                hidden={hidden}
              />
              <ExpenseByCategory expense={current?.expense} names={names} hidden={hidden} />
              <RecentTransactions transactions={recent.data?.data} names={names} hidden={hidden} error={recent.error} />
            </>
          )}
        </div>

        <aside className="min-w-0" aria-label="Presupuestos del mes">
          <div className="lg:sticky lg:top-8">
            <BudgetOverview
              budgets={budgets.data}
              names={names}
              monthLabel={label}
              error={online ? budgets.error : ''}
              note={offlineNote}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
