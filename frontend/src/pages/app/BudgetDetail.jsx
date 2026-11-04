import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import BudgetForm from '@/components/budgets/BudgetForm';
import { currentMonth, formatMonth } from '@/components/budgets/month';
import CircleActions from '@/components/common/CircleActions';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import FilteredMovements from '@/components/money/FilteredMovements';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { displayLevel, isAtLimit } from '@/lib/budgetLevel';
import { cn } from '@/lib/utils';
import { TRANSACTION_SAVED_EVENT } from '@/offline/saveNewTransaction';
import { deleteBudget, listBudgets, updateBudget } from '@/services/budgetService';
import { monthRange } from '@/services/summaryService';

const BAR = { none: 'bg-positive', warning_80: 'bg-caution', exceeded_100: 'bg-negative' };

/**
 * Página privada `/app/presupuestos/:category?mes=AAAA-MM`: cuánto lleva un presupuesto, sus
 * movimientos y las opciones de anotar otro o modificarlo.
 */
export default function BudgetDetail() {
  const { category } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const month = params.get('mes') ?? currentMonth();
  const budgets = useAsync(() => listBudgets(month), [month, online]);
  const { categories, names } = useCategoryNames();
  const [editing, setEditing] = useState(false);
  const budget = budgets.data?.find((b) => b.category === category);
  const expense = categories?.expense ?? [];
  const name = names[category] ?? category;
  usePageTitle(name);
  const { reload } = budgets;

  useEffect(() => {
    window.addEventListener(TRANSACTION_SAVED_EVENT, reload);
    return () => window.removeEventListener(TRANSACTION_SAVED_EVENT, reload);
  }, [reload]);

  if (budgets.error) {
    return (
      <p role="alert" className="text-sm text-negative">
        {budgets.error}{' '}
        <button type="button" className="underline" onClick={reload}>
          Reintentar
        </button>
      </p>
    );
  }
  if (!budgets.data) {
    return (
      <p className="flex items-center gap-2 py-10 text-ink/60" aria-busy="true">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  }
  if (!budget) return <p className="py-10 text-center text-ink/60">Este presupuesto ya no existe.</p>;

  const level = displayLevel(budget.alert);
  const money = (value) => (hidden ? '$ ••••••' : formatMoney(value));
  const over = budget.alert.level === 'exceeded_100' && !isAtLimit(budget.alert);

  return (
    <div className="mx-auto flex max-w-xl flex-col">
      <h1 className="text-[28px] font-semibold tracking-tight">{name}</h1>
      <p className="mt-4 text-[15px] text-ink/70">Vas en</p>
      <p className="text-[42px] font-semibold leading-tight tracking-tight tabular-nums">{Math.round(budget.percentage)} %</p>
      <div
        role="meter"
        aria-label={`Consumo de ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(budget.percentage, 100)}
        className="mt-3 h-2 rounded-full bg-ink/10"
      >
        <div className={cn('h-full origin-left rounded-full motion-safe:animate-bar-in motion-safe:transition-[width] motion-safe:duration-500', BAR[level])} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
      </div>
      <p className="mt-2 text-sm tabular-nums text-ink/70">
        {over
          ? `Te pasaste por ${money(budget.consumed - budget.amount)} de ${money(budget.amount)}`
          : `Quedan ${money(Math.max(0, budget.amount - budget.consumed))} de ${money(budget.amount)}`}
      </p>

      <CircleActions
        label="Acciones del presupuesto"
        className="mt-5 md:mx-0"
        actions={[
          { to: `/app/anotar?categoria=${encodeURIComponent(category)}`, label: 'Anotar', icon: Plus, primary: true },
          { onClick: () => setEditing(true), label: 'Modificar presupuesto', icon: Pencil, disabled: !online },
        ]}
      />

      <h2 className="mb-2 mt-6 text-lg font-semibold tracking-tight">Movimientos de {name}</h2>
      <FilteredMovements
        filters={{ type: 'gasto', category, ...monthRange(month) }}
        names={names}
        hidden={hidden}
        empty="Aún no hay movimientos en este presupuesto."
      />

      <Sheet open={editing} title="Modificar presupuesto" onClose={() => setEditing(false)}>
        <BudgetForm
          categories={expense}
          usedCategories={[]}
          monthLabel={formatMonth(month)}
          initial={budget}
          disabled={!online}
          onSubmit={async ({ amount }) => {
            await updateBudget(budget.id, amount);
            setEditing(false);
            reload();
          }}
          onCancel={() => setEditing(false)}
        />
        <div className="mt-3 text-center">
          <ConfirmButton
            label="Eliminar presupuesto"
            question="¿Eliminar este presupuesto?"
            confirmLabel="Sí, eliminar"
            icon={Trash2}
            disabled={!online}
            onConfirm={async () => {
              await deleteBudget(budget.id);
              navigate('/app/presupuestos', { replace: true });
            }}
          />
        </div>
      </Sheet>
    </div>
  );
}
