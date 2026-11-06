import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MASK } from '@/components/dashboard/BalanceCard';
import ExpenseByCategory from '@/components/dashboard/ExpenseByCategory';
import PeriodSelector from '@/components/dashboard/PeriodSelector';
import Panel from '@/components/layout/Panel';
import FilteredMovements from '@/components/money/FilteredMovements';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { periodLabel, todayIso } from '@/lib/period';
import { cn } from '@/lib/utils';
import { getSummary } from '@/services/summaryService';

const CONFIG = {
  ingreso: { title: 'Ingresos', tone: 'text-positive', listTitle: 'Movimientos de ingresos', empty: 'No hay ingresos en este periodo.' },
  gasto: { title: 'Gastos', tone: 'text-negative', listTitle: 'Movimientos de gastos', empty: 'No hay gastos en este periodo.' },
};

/**
 * Páginas `/app/ingresos` y `/app/gastos`: el total del periodo en grande, lo otro y el balance, y sus
 * movimientos. Gastos agrega en qué se fue la plata.
 * @param {{ type: 'ingreso'|'gasto' }} props
 */
export default function PeriodDetail({ type }) {
  const { title, tone, listTitle, empty } = CONFIG[type];
  usePageTitle(title);
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const { names } = useCategoryNames();
  const { state } = useLocation();
  const [selected, setSelected] = useState(state?.selected ?? { period: 'month', date: todayIso() });
  const summary = useAsync(() => getSummary(selected.period, selected.date), [selected.period, selected.date, online]);
  const current = summary.loading || summary.error ? undefined : summary.data;
  const money = (value) => (current === undefined ? '…' : hidden ? MASK : formatMoney(value));
  const income = type === 'ingreso';
  const total = income ? current?.income.total : current?.expense.total;

  const rows = [
    income ? ['Gastos', current?.expense.total, 'text-negative'] : ['Ingresos', current?.income.total, 'text-positive'],
    ...(current?.savings.total > 0 ? [['Ahorro', current.savings.total, '']] : []),
    ['Balance', current?.balance, ''],
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
      <PeriodSelector stacked period={selected.period} date={selected.date} onChange={setSelected} />

      {summary.error ? (
        <p role="alert" className="text-sm text-negative">
          {online ? summary.error : 'Sin conexión: se actualiza al volver internet.'}{' '}
          <button type="button" className="underline" onClick={summary.reload}>
            Reintentar
          </button>
        </p>
      ) : (
        <>
          <div aria-busy={current === undefined}>
            <p className="text-[15px] text-ink/70 first-letter:uppercase">
              {title} de {periodLabel(selected.period, selected.date)}
            </p>
            <p className={cn('mt-1 text-[42px] font-semibold leading-tight tracking-tight tabular-nums', tone)}>{money(total)}</p>
          </div>
          <Panel className="py-0 md:py-0">
            <dl className="divide-y divide-ink/10">
              {rows.map(([label, value, rowTone]) => (
                <div key={label} className="flex min-h-[52px] items-center justify-between gap-4 text-[15px]">
                  <dt className="text-ink/70">{label}</dt>
                  <dd className={cn('font-semibold tabular-nums', rowTone)}>{money(value)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </>
      )}

      {!income && <ExpenseByCategory expense={current?.expense} names={names} hidden={hidden} />}

      <section aria-labelledby="movimientos-periodo">
        <h2 id="movimientos-periodo" className="mb-2 text-lg font-semibold tracking-tight">
          {listTitle}
        </h2>
        {current ? (
          <FilteredMovements filters={{ type, from: current.from, to: current.to }} names={names} hidden={hidden} empty={empty} />
        ) : (
          <div className="h-24 animate-pulse rounded-2xl bg-ink/5" aria-hidden="true" />
        )}
      </section>

      <Button asChild variant="soft" size="lg">
        <Link to="/app/mi-plata">Ver los movimientos</Link>
      </Button>
    </div>
  );
}
