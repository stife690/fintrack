import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/components/transactions/format';

/** Montos cortos para el eje Y: `$ 850 mil`, `$ 1,2 M`. */
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const formatAxis = (value) => (value === 0 ? '0' : `$ ${compact.format(value)}`);

/** Cuadro al pasar el mouse (o tocar) un día: lo gastado hasta ese día o lo proyectado. */
function PaceTooltip({ active, payload, month }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1, point.day).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return (
    <div className="rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium">{date}</p>
      {point.real !== undefined && (
        <p className="text-ink/70">
          Gastado: <span className="tabular-nums text-ink">{formatMoney(point.real)}</span>
        </p>
      )}
      {point.projection !== undefined && point.real === undefined && (
        <p className="text-ink/70">
          Proyectado: <span className="tabular-nums text-ink">{formatMoney(point.projection)}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Gasto acumulado del mes (área), proyección hasta fin de mes (línea punteada) e ingresos
 * esperados (línea horizontal). Va en su propio archivo para cargar Recharts aparte, como el
 * gráfico de Inicio.
 *
 * @param {object} props
 * @param {Array<{ day: number, real?: number, projection?: number }>} props.data De `paceSeries`.
 * @param {number} props.income Ingresos esperados; 0 para no dibujar la línea.
 * @param {string} props.month AAAA-MM
 */
export default function SpendingPaceLines({ data, income, month }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'currentColor', fillOpacity: 0.55, fontSize: 12 }}
          interval={4}
        />
        <YAxis
          tickFormatter={formatAxis}
          tickLine={false}
          axisLine={false}
          width={64}
          tick={{ fill: 'currentColor', fillOpacity: 0.55, fontSize: 12 }}
        />
        <Tooltip content={<PaceTooltip month={month} />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }} />
        {income > 0 && (
          <ReferenceLine y={income} stroke="var(--app-chart-income)" strokeWidth={1.5} ifOverflow="extendDomain" />
        )}
        <Area
          type="monotone"
          dataKey="real"
          stroke="var(--color-brand)"
          strokeWidth={2.5}
          fill="var(--color-brand)"
          fillOpacity={0.12}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="projection"
          stroke="var(--color-brand)"
          strokeWidth={2}
          strokeDasharray="6 5"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
