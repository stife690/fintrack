import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/components/transactions/format';

/** Montos cortos para el eje Y: `$ 850 mil`, `$ 1,2 M`. */
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const formatAxis = (value) => (value === 0 ? '0' : `$ ${compact.format(value)}`);

/**
 * Cuadro que aparece al pasar el mouse (o tocar) una columna: fecha, ingresos y gastos.
 * Recharts le pasa `active`, `payload` (los datos de la columna) y nada más que necesitemos.
 */
function ChartTooltip({ active, payload, hidden, series }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium first-letter:uppercase">{point.fullLabel}</p>
      {series.map((s) => (
        <p key={s.key} className="flex items-center justify-between gap-4 text-ink/70">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="tabular-nums text-ink">{hidden ? '$ ••••••' : formatMoney(point[s.key])}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Columnas de ingresos y gastos con Recharts. Va en su propio archivo para cargarse aparte
 * (ver `IncomeExpenseChart`): Recharts pesa ~100 KB gzip y no debe retrasar el dashboard.
 *
 * @param {object} props
 * @param {Array<object>} props.data Una cajita por día o mes, con `label`, `income` y `expense`.
 * @param {'week'|'month'|'year'} props.period
 * @param {boolean} props.hidden Ocultar montos.
 * @param {Array<{ key: string, label: string, color: string }>} props.series
 */
export default function IncomeExpenseBars({ data, period, hidden, series }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={period === 'month' ? 1 : 2} barCategoryGap={period === 'month' ? '8%' : '30%'} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'currentColor', fillOpacity: 0.55, fontSize: 12 }}
          interval={period === 'month' ? 4 : 0}
        />
        <YAxis
          tickFormatter={hidden ? () => '' : formatAxis}
          tickLine={false}
          axisLine={false}
          width={hidden ? 8 : 64}
          tick={{ fill: 'currentColor', fillOpacity: 0.55, fontSize: 12 }}
        />
        <Tooltip content={<ChartTooltip hidden={hidden} series={series} />} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
