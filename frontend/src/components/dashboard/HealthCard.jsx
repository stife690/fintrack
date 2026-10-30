import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HeartPulse } from 'lucide-react';
import { LEVELS, dailyAllowance } from '@/components/insights/analytics';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import { TRANSACTION_SAVED_EVENT } from '@/offline/saveNewTransaction';
import { cn } from '@/lib/utils';
import { getAnalytics } from '@/services/analyticsService';

const TEXT = { positive: 'text-positive', caution: 'text-caution', negative: 'text-negative' };

/**
 * Inicio → resumen de la salud financiera (FT-0019): el puntaje, su nivel y cuánto se puede
 * gastar por día lo que queda del mes. El detalle está en Insights, a donde lleva la tarjeta.
 * Carga sus propios datos; si falla (p. ej. sin conexión) o el mes no tiene movimientos, no se
 * muestra: no es imprescindible en el inicio.
 *
 * @param {{ hidden: boolean }} props `hidden`: ocultar montos, como el resto del inicio.
 */
export default function HealthCard({ hidden }) {
  const { data, error, reload } = useAsync(getAnalytics, []);

  // Un movimiento nuevo desde la barra rápida cambia el puntaje.
  useEffect(() => {
    window.addEventListener(TRANSACTION_SAVED_EVENT, reload);
    return () => window.removeEventListener(TRANSACTION_SAVED_EVENT, reload);
  }, [reload]);

  if (error || !data || data.empty) return null;
  const { label, tone } = LEVELS[data.health.level];
  const perDay = dailyAllowance(data);

  return (
    <Panel aria-labelledby="salud-inicio">
      <Link
        to="/app/insights"
        className="-m-2 flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink/5 text-xl font-semibold tabular-nums">
          {data.health.score}
          <span className="sr-only"> de 100</span>
        </span>
        <span className="min-w-0 flex-1">
          <span id="salud-inicio" className="flex items-center gap-1.5 text-sm text-ink/70">
            <HeartPulse className="size-4" aria-hidden="true" />
            Salud financiera · <span className={cn('font-semibold', TEXT[tone])}>{label}</span>
          </span>
          <span className="mt-1 block text-sm">
            {perDay > 0 ? (
              <>
                Puedes gastar{' '}
                <span className="font-semibold tabular-nums">{hidden ? '$ ••••••' : formatMoney(perDay)}</span> por día
                hasta fin de mes
              </>
            ) : (
              'Ya gastaste lo que ingresó este mes'
            )}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
        <span className="sr-only">Ver el detalle en Insights</span>
      </Link>
    </Panel>
  );
}
