import { useMemo } from 'react';
import BalanceCard from '@/components/dashboard/BalanceCard';
import BudgetOverview, { BudgetAlert } from '@/components/dashboard/BudgetOverview';
import QuickActions from '@/components/dashboard/QuickActions';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { currentMonth } from '@/components/budgets/month';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/auth/AuthContext';
import useAsync from '@/hooks/useAsync';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import usePageTitle from '@/hooks/usePageTitle';
import { getDisplayName } from '@/lib/displayName';
import { listBudgets } from '@/services/budgetService';
import { getMonthTotals } from '@/services/summaryService';
import { getCategories, listTransactions } from '@/services/transactionService';

const RECENT_COUNT = 5;

/** `octubre` a partir de `2026-10`. */
function monthName(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
}

/**
 * Página privada `/app`: balance del mes, accesos rápidos, alertas y resumen de presupuestos
 * (FT-0005) y últimos movimientos. Cada bloque carga por separado: si uno falla, los demás se ven.
 *
 * Los gráficos y el selector de periodo del dashboard son de FT-0004 y van en una fase aparte.
 */
export default function Dashboard() {
  usePageTitle('Inicio');
  const { user } = useAuth();
  const [hidden, toggleHidden] = useHiddenAmounts();
  const month = currentMonth();
  const label = monthName(month);

  const totals = useAsync(() => getMonthTotals(month), [month]);
  const budgets = useAsync(() => listBudgets(month), [month]);
  const recent = useAsync(() => listTransactions({ page: 1, pageSize: RECENT_COUNT }), []);
  const categories = useAsync(getCategories, []);

  const names = useMemo(() => {
    const all = categories.data ? [...categories.data.expense, ...categories.data.income] : [];
    return Object.fromEntries(all.map((c) => [c.key, c.name]));
  }, [categories.data]);

  const name = getDisplayName(user);

  return (
    <>
      <PageHeader title={name ? `Hola, ${name}` : 'Hola'} description={`Así va tu ${label}.`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <BalanceCard monthLabel={label} totals={totals.data} hidden={hidden} onToggleHidden={toggleHidden} />
          {totals.error && (
            <p role="alert" className="-mt-2 text-sm text-negative">
              No pudimos calcular el balance: {totals.error}{' '}
              <button type="button" className="underline" onClick={totals.reload}>
                Reintentar
              </button>
            </p>
          )}
          <QuickActions />
          {budgets.data && <BudgetAlert budgets={budgets.data} names={names} />}
          <RecentTransactions transactions={recent.data?.data} names={names} hidden={hidden} error={recent.error} />
        </div>

        <aside className="min-w-0" aria-label="Presupuestos del mes">
          <div className="lg:sticky lg:top-8">
            <BudgetOverview budgets={budgets.data} names={names} monthLabel={label} error={budgets.error} />
          </div>
        </aside>
      </div>
    </>
  );
}
