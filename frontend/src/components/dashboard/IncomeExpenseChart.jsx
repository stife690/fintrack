import { lazy, Suspense, useMemo } from 'react';
import { formatMoney } from '@/components/transactions/format';
import { periodBuckets } from '@/lib/period';
import { cn } from '@/lib/utils';

const SERIES = [
  { key: 'income', label: 'Ingresos', color: 'var(--app-chart-income)' },
  { key: 'expense', label: 'Gastos', color: 'var(--app-chart-expense)' },
];

// Recharts va en un chunk aparte: el dashboard se pinta sin esperarlo.
const IncomeExpenseBars = lazy(() => import('./IncomeExpenseBars'));

/**
 * Ingresos contra gastos a lo largo del periodo (FT-0004): columnas por día (semana, mes)
 * o por mes (año). Los días sin movimientos aparecen en 0 para que el eje no salte fechas.
 *
 * Accesibilidad: leyenda con texto, tooltip con los valores y una tabla oculta a la vista
 * que leen los lectores de pantalla (el gráfico en sí se marca como imagen).
 *
 * @param {object} props
 * @param {'week'|'month'|'year'} props.period
 * @param {string} props.date
 * @param {Array<{ date: string, income: number, expense: number }>|undefined} props.timeSeries `undefined` mientras carga.
 * @param {boolean} props.hidden Ocultar montos.
 * @param {string} [props.className]
 */
export default function IncomeExpenseChart({ period, date, timeSeries, hidden, className }) {
  // Une las cajitas del periodo con los datos: lo que no llegue de la API queda en 0.
  const data = useMemo(() => {
    if (!timeSeries) return [];
    const byDate = new Map(timeSeries.map((p) => [p.date, p]));
    return periodBuckets(period, date).map((b) => ({
      ...b,
      income: byDate.get(b.date)?.income ?? 0,
      expense: byDate.get(b.date)?.expense ?? 0,
    }));
  }, [timeSeries, period, date]);

  const empty = timeSeries !== undefined && timeSeries.length === 0;


  return (
    <section
      aria-labelledby="trend-title"
      className={cn('rounded-3xl border border-ink/10 bg-surface p-5 md:p-6', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="trend-title" className="text-base font-semibold">
            Ingresos y gastos
          </h2>
          <p className="mt-0.5 text-sm text-ink/60">{period === 'year' ? 'Por mes' : 'Por día'}</p>
        </div>
        <ul className="flex gap-4 text-sm text-ink/70">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      {timeSeries === undefined && <div className="mt-5 h-56 animate-pulse rounded-2xl bg-ink/6" aria-hidden="true" />}

      {empty && <p className="mt-5 text-sm text-ink/60">No hay movimientos en este periodo.</p>}

      {!empty && timeSeries && (
        <>
          <div className="mt-5 h-56" role="img" aria-label="Gráfico de columnas de ingresos y gastos; los valores están en la tabla siguiente">
            <Suspense fallback={<div className="h-full animate-pulse rounded-2xl bg-ink/6" />}>
              <IncomeExpenseBars data={data} period={period} hidden={hidden} series={SERIES} />
            </Suspense>
          </div>

          {/* sr-only va en un div: en una tabla el ancho de 1 px no aplica y la página se desbordaba en celular. */}
          <div className="sr-only">
            <table>
              <caption>Ingresos y gastos {period === 'year' ? 'por mes' : 'por día'}</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Ingresos</th>
                  <th scope="col">Gastos</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter((p) => p.income || p.expense)
                  .map((p) => (
                    <tr key={p.date}>
                      <th scope="row">{p.fullLabel}</th>
                      <td>{hidden ? 'oculto' : formatMoney(p.income)}</td>
                      <td>{hidden ? 'oculto' : formatMoney(p.expense)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
