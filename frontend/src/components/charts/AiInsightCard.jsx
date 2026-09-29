import { Area, AreaChart, ResponsiveContainer, XAxis } from 'recharts';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Gasto semanal en alimentación (miles de pesos); las dos últimas semanas son la proyección. */
const DATA = [
  { week: 'S1', real: 120 },
  { week: 'S2', real: 135 },
  { week: 'S3', real: 170 },
  { week: 'S4', real: 190, proyeccion: 190 },
  { week: 'S5', proyeccion: 150 },
  { week: 'S6', proyeccion: 125 },
];

/**
 * Tarjeta "Análisis con IA": un insight en lenguaje natural y una tendencia
 * con la proyección si se sigue la sugerencia (línea punteada).
 * @param {{ className?: string }} props
 */
export default function AiInsightCard({ className }) {
  return (
    <div className={cn('w-full overflow-hidden rounded-3xl bg-white text-left text-obsidian shadow-elevated', className)}>
      <div className="flex items-center gap-3 bg-pink px-5 py-4">
        <span className="grid size-10 place-items-center rounded-2xl bg-gradient-violet text-white">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold leading-tight">Análisis con IA</p>
          <p className="text-sm text-muted-foreground">Tu asistente financiero</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm leading-relaxed">
          Este mes gastaste <strong className="text-violet">18% más en alimentación</strong> que en agosto. Si reduces
          los domicilios a 2 por semana, podrías ahorrar <strong>$120.000</strong>.
        </p>

        <div className="h-20" role="img" aria-label="Tendencia del gasto en alimentación con proyección a la baja">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DATA} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="ai-real" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6142ff" stopOpacity={0.3} />
                  <stop offset="1" stopColor="#6142ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" hide />
              <Area type="monotone" dataKey="real" stroke="#6142ff" strokeWidth={2} fill="url(#ai-real)" />
              <Area
                type="monotone"
                dataKey="proyeccion"
                stroke="#2fd6a3"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-violet" /> Gasto real
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-success" /> Con la sugerencia
          </span>
        </div>
      </div>
    </div>
  );
}
