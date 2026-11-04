import { useState } from 'react';
import { Link } from 'react-router-dom';
import ExpenseByCategory from '@/components/dashboard/ExpenseByCategory';
import PeriodSelector from '@/components/dashboard/PeriodSelector';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { todayIso } from '@/lib/period';
import { cn } from '@/lib/utils';
import { MASK } from '@/components/dashboard/BalanceCard';
import { getSummary } from '@/services/summaryService';

/**
 * Página privada `/app/mes`: cuánto entró, cuánto salió y en qué se fue, por semana, mes o año. Se
 * abre al tocar Ingresos o Gastos en el inicio.
 */
export default function Month() {
  usePageTitle('Cómo va el mes');
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const { names } = useCategoryNames();
  const [selected, setSelected] = useState({ period: 'month', date: todayIso() });
  const summary = useAsync(() => getSummary(selected.period, selected.date), [selected.period, selected.date, online]);
  const current = summary.loading ? undefined : summary.data;
  const money = (value) => (current === undefined ? '…' : hidden ? MASK : formatMoney(value));

  const rows = [
    ['Ingresos', current?.income.total, 'text-positive'],
    ['Gastos', current?.expense.total, 'text-negative'],
    ...(current?.savings.total > 0 ? [['Ahorro', current.savings.total, '']] : []),
    ['Balance', current?.balance, ''],
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <PageHeader title="Cómo va el mes" />
      <PeriodSelector period={selected.period} date={selected.date} onChange={setSelected} />

      {summary.error && !current ? (
        <p role="alert" className="text-sm text-negative">
          {online ? summary.error : 'Sin conexión: se actualiza al volver internet.'}{' '}
          <button type="button" className="underline" onClick={summary.reload}>
            Reintentar
          </button>
        </p>
      ) : (
        <Panel className="py-0 md:py-0" aria-busy={current === undefined}>
          <dl className="divide-y divide-ink/10">
            {rows.map(([label, value, tone]) => (
              <div key={label} className="flex min-h-[52px] items-center justify-between gap-4 text-[15px]">
                <dt className="text-ink/60">{label}</dt>
                <dd className={cn('font-semibold tabular-nums', tone)}>{money(value)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      <ExpenseByCategory expense={current?.expense} names={names} hidden={hidden} />

      <Button asChild variant="soft" size="lg">
        <Link to="/app/mi-plata">Ver los movimientos</Link>
      </Button>
    </div>
  );
}
