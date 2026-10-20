import { Lightbulb, PiggyBank, TrendingUp, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Ícono y color por tipo de insight; un tipo desconocido se muestra como consejo general. */
const TYPES = {
  saving_opportunity: { Icon: PiggyBank, label: 'Oportunidad de ahorro', style: 'bg-positive/15 text-positive' },
  overspending_alert: { Icon: TriangleAlert, label: 'Ojo con este gasto', style: 'bg-caution/15 text-caution' },
  positive_trend: { Icon: TrendingUp, label: 'Buena tendencia', style: 'bg-positive/15 text-positive' },
  general_tip: { Icon: Lightbulb, label: 'Consejo', style: 'bg-brand-soft text-brand' },
};

/**
 * Tarjeta de un insight generado por IA.
 * @param {{ insight: import('@/services/insightService').Insight, className?: string }} props
 */
export default function InsightCard({ insight, className }) {
  const { Icon, label, style } = TYPES[insight.type] ?? TYPES.general_tip;
  return (
    <article className={cn('flex gap-4 rounded-2xl border border-ink/10 bg-surface p-5', className)}>
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', style)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/60">{label}</p>
        <h3 className="mt-1 font-semibold leading-snug">{insight.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink/80">{insight.detail}</p>
      </div>
    </article>
  );
}
