import { Link } from 'react-router-dom';
import { ChartPie, CircleAlert, CircleCheck, Loader2, TriangleAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import { todayIso } from '@/lib/period';
import { cn } from '@/lib/utils';
import { listBudgets } from '@/services/budgetService';
import { getSummary } from '@/services/summaryService';
import { getCategories } from '@/services/transactionService';
import { buildMonthHighlights } from './highlights';

const TONES = {
  positive: 'bg-positive/15 text-positive',
  caution: 'bg-caution/15 text-caution',
  negative: 'bg-negative/15 text-negative',
  neutral: 'bg-brand-soft text-brand',
};

/** Ícono según el dato y, en presupuestos, según cómo va. */
function iconFor({ kind, tone }) {
  if (kind === 'top') return ChartPie;
  if (kind === 'balance') return Wallet;
  return tone === 'positive' ? CircleCheck : tone === 'caution' ? TriangleAlert : CircleAlert;
}

/** Datos del resumen, presupuestos y categorías del mes actual, juntos. */
async function loadMonth() {
  const today = todayIso();
  const [summary, budgets, categories] = await Promise.all([
    getSummary('month', today),
    // Sin presupuestos se muestran igual el mayor gasto y el balance.
    listBudgets(today.slice(0, 7)).catch(() => []),
    getCategories(),
  ]);
  const all = [...categories.expense, ...categories.income];
  const names = Object.fromEntries(all.map((c) => [c.key, c.name]));
  return buildMonthHighlights({ summary, budgets, names });
}

/**
 * "Tu mes hasta hoy" en Insights mientras no hay un mes de historial: tarjetas cortas calculadas
 * sin IA (presupuesto más cerca del límite, mayor gasto y balance). Sin movimientos, invita a
 * registrar el primero.
 * @param {{ message: string }} props Aviso de la API sobre el historial que falta.
 */
export default function MonthHighlights({ message }) {
  const { data: highlights, error, loading } = useAsync(loadMonth, []);

  if (loading && !highlights) {
    return (
      <p className="flex items-center gap-2 py-6 text-ink/60">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Revisando tu mes…
      </p>
    );
  }

  if (error || !highlights?.length) {
    return (
      <div className="py-6 text-center">
        <p className="font-medium">Todavía no hay suficiente historial</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink/70">{message}</p>
        <Button asChild className="mt-4">
          <Link to="/app/transacciones">Registrar un movimiento</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <ul className="grid gap-3">
        {highlights.map((highlight) => {
          const Icon = iconFor(highlight);
          return (
            <li
              key={highlight.kind}
              className="flex items-center gap-3 rounded-2xl border border-ink/10 px-4 py-3 motion-safe:animate-fade-up"
            >
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONES[highlight.tone])}>
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{highlight.title}</p>
                <p className="text-sm text-ink/70">{highlight.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-ink/60">
        Los consejos con IA llegan cuando tengas un mes de movimientos. Mientras tanto, pregúntale al asistente.
      </p>
    </>
  );
}
