import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { cn } from '@/lib/utils';

/** Datos de ejemplo: ingresos y gastos de los últimos 6 meses (en miles de pesos). */
const DATA = [
  { month: 'Abr', ingresos: 2100, gastos: 1650 },
  { month: 'May', ingresos: 2250, gastos: 1900 },
  { month: 'Jun', ingresos: 2100, gastos: 1500 },
  { month: 'Jul', ingresos: 2400, gastos: 2050 },
  { month: 'Ago', ingresos: 2300, gastos: 1750 },
  { month: 'Sep', ingresos: 2450, gastos: 1620 },
];

const money = (value) => `$${(value * 1000).toLocaleString('es-CO')}`;

/** Tooltip oscuro con el formato de la tarjeta. */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-obsidian px-3 py-2 text-xs text-white shadow-elevated">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.dataKey === 'ingresos' ? 'Ingresos' : 'Gastos'}: {money(p.value)}
        </p>
      ))}
    </div>
  );
}

/**
 * Tarjeta "Reporte del mes": totales + barras de ingresos vs. gastos (Recharts).
 * @param {{ className?: string }} props
 */
export default function ReportCard({ className }) {
  const last = DATA[DATA.length - 1];
  return (
    <div className={cn('w-full rounded-3xl bg-white p-5 text-left text-obsidian shadow-elevated', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Reporte de septiembre</p>
          <p className="text-2xl font-semibold tracking-tight">{money(last.ingresos - last.gastos)}</p>
          <p className="text-sm text-muted-foreground">ahorrados este mes</p>
        </div>
        <span className="rounded-md bg-mint px-1.5 py-0.5 text-sm font-medium text-emerald-700">+12%</span>
      </div>

      <div className="mt-4 h-36" role="img" aria-label="Gráfico de barras de ingresos y gastos de abril a septiembre">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} barGap={3} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6e6e6e' }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(97, 66, 255, 0.06)' }} />
            <Bar dataKey="ingresos" fill="#6142ff" radius={[6, 6, 6, 6]} maxBarSize={12} />
            <Bar dataKey="gastos" fill="#d8a0df" radius={[6, 6, 6, 6]} maxBarSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-violet" /> Ingresos
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-orchid" /> Gastos
        </span>
      </div>
    </div>
  );
}
