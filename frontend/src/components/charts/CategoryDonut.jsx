import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

/** Gastos del mes por categoría (porcentajes de ejemplo; nombres del catálogo fijo RN-02). */
export const CATEGORIES = [
  { name: 'Alimentación', value: 38, color: '#6142ff' },
  { name: 'Transporte', value: 22, color: '#8b66ff' },
  { name: 'Vivienda', value: 20, color: '#d8a0df' },
  { name: 'Entretenimiento', value: 12, color: '#2fd6a3' },
  { name: 'Otros', value: 8, color: '#4a4a4a' },
];

/**
 * Dona de gastos por categoría con leyenda, para fondos oscuros (teléfono de la sección App).
 * @param {{ className?: string }} props
 */
export default function CategoryDonut({ className }) {
  return (
    <div className={cn('flex items-center gap-4 rounded-2xl bg-[#1b1b1b] p-4', className)}>
      <div className="relative size-28 shrink-0" role="img" aria-label="Gráfico de dona de gastos por categoría">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={CATEGORIES}
              dataKey="value"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={3}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {CATEGORIES.map((c) => (
                <Cell key={c.name} fill={c.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] text-white/50">Gastos</p>
            <p className="text-sm font-semibold text-white">$1,6 M</p>
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 text-xs">
        {CATEGORIES.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-2 text-white/70">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: c.color }} />
              {c.name}
            </span>
            <span className="text-white">{c.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
