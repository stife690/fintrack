import { Link } from 'react-router-dom';
import { ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react';
import CategoryIcon from '@/components/categories/CategoryIcon';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { displayLevel, isAtLimit } from '@/lib/budgetLevel';
import { cn } from '@/lib/utils';

const BAR = { none: 'bg-positive', warning_80: 'bg-caution', exceeded_100: 'bg-negative' };
const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Cuántos presupuestos se muestran en el inicio; el resto, en la pantalla de presupuestos. */
const VISIBLE = 4;

/**
 * Aviso destacado cuando algún presupuesto llegó al 80 %, se acabó o se pasó (RN-04).
 * @param {{ budgets: import('@/services/budgetService').Budget[], names: Record<string, string> }} props
 */
export function BudgetAlert({ budgets, names }) {
  const atLimit = budgets.filter((b) => isAtLimit(b.alert));
  const exceeded = budgets.filter((b) => displayLevel(b.alert) === 'exceeded_100');
  const warning = budgets.filter((b) => b.alert.level === 'warning_80');
  if (exceeded.length === 0 && atLimit.length === 0 && warning.length === 0) return null;

  const name = (b) => names[b.category] ?? b.category;
  let message;
  if (exceeded.length > 0) {
    message =
      exceeded.length === 1
        ? `Te pasaste del presupuesto de ${name(exceeded[0])}.`
        : `Te pasaste en ${exceeded.length} presupuestos.`;
  } else if (atLimit.length > 0) {
    message =
      atLimit.length === 1
        ? `Ya usaste todo tu presupuesto de ${name(atLimit[0])}.`
        : `Ya usaste todo el presupuesto en ${atLimit.length} categorías.`;
  } else {
    message =
      warning.length === 1
        ? `${name(warning[0])} va en ${percent.format(warning[0].percentage)} % del límite.`
        : `${warning.length} presupuestos pasaron del 80 %.`;
  }

  return (
    <Link
      to="/app/presupuestos"
      className={cn(
        'flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors',
        exceeded.length > 0 ? 'bg-negative/10 text-negative hover:bg-negative/15' : 'bg-caution/10 text-caution hover:bg-caution/15',
      )}
    >
      <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}

/**
 * Resumen de presupuestos del mes: los de mayor consumo primero, con su barra.
 * @param {object} props
 * @param {import('@/services/budgetService').Budget[]|undefined} props.budgets `undefined` mientras carga.
 * @param {Record<string, string>} props.names Nombre por clave de categoría.
 * @param {string} props.monthLabel
 * @param {string} [props.error]
 * @param {string} [props.note] Aviso neutral en lugar de la carga cuando no hay datos que esperar (p. ej. sin conexión).
 */
export default function BudgetOverview({ budgets, names, monthLabel, error, note }) {
  const sorted = budgets ? [...budgets].sort((a, b) => b.percentage - a.percentage) : [];
  const allGood = budgets?.length > 0 && budgets.every((b) => b.alert.level === 'none');

  return (
    <Panel aria-labelledby="budgets-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="budgets-title" className="text-lg font-semibold tracking-tight">
          Presupuestos
        </h2>
        <Link to="/app/presupuestos" className="text-sm font-medium text-brand hover:underline">
          Ver todos
        </Link>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-negative">{error}</p>
      ) : budgets === undefined && note ? (
        <p className="mt-4 text-sm text-ink/60">{note}</p>
      ) : budgets === undefined ? (
        <div className="mt-5 space-y-5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-ink/5" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-ink/60">
            No tienes presupuestos en {monthLabel}. Ponle un límite a una categoría y te avisamos antes de pasarte.
          </p>
          <Link
            to="/app/presupuestos"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-brand-soft px-4 text-sm font-medium text-brand"
          >
            Crear presupuesto
          </Link>
        </div>
      ) : (
        <>
          {allGood && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-positive">
              <CircleCheck className="size-4" aria-hidden="true" />
              Vas bien en todos.
            </p>
          )}
          <ul className="mt-4 space-y-4">
            {sorted.slice(0, VISIBLE).map((b) => {
              const name = names[b.category] ?? b.category;
              return (
                <li key={b.id} className="flex items-center gap-3">
                  <CategoryIcon category={b.category} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{name}</span>
                      <span className="shrink-0 tabular-nums text-ink/60">{percent.format(b.percentage)} %</span>
                    </div>
                    <div
                      role="meter"
                      aria-label={`Consumo de ${name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(b.percentage, 100)}
                      aria-valuetext={`${percent.format(b.percentage)} %: ${formatMoney(b.consumed)} de ${formatMoney(b.amount)}`}
                      className="mt-1.5 h-1.5 rounded-full bg-ink/10"
                    >
                      <div
                        className={cn('h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500', BAR[displayLevel(b.alert)])}
                        style={{ width: `${Math.min(b.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {sorted.length > VISIBLE && (
            <p className="mt-4 text-sm text-ink/60">y {sorted.length - VISIBLE} más</p>
          )}
        </>
      )}
    </Panel>
  );
}
