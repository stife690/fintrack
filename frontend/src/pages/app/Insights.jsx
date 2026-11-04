import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ChevronRight, Landmark, Loader2, Sparkles } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import { LEVELS } from '@/components/insights/analytics';
import AssistantChat from '@/components/insights/AssistantChat';
import InsightCard from '@/components/insights/InsightCard';
import MonthAnalytics from '@/components/insights/MonthAnalytics';
import MonthHighlights from '@/components/insights/MonthHighlights';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatMonth } from '@/components/budgets/month';
import useAsync from '@/hooks/useAsync';
import useMediaQuery from '@/hooks/useMediaQuery';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { getAnalytics } from '@/services/analyticsService';
import usePageTitle from '@/hooks/usePageTitle';
import { getInsights } from '@/services/insightService';

/**
 * Título del panel de consejos según el periodo que comparó la API.
 * @param {{ period: 'week'|'month', month: string, from: string }} data
 * @returns {string} "Esta semana, desde el lunes 19 de octubre" u "octubre de 2026".
 */
export function insightsTitle({ period, month, from }) {
  if (period !== 'week') return formatMonth(month);
  const monday = new Date(`${from}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return `Esta semana, desde el lunes ${monday}`;
}

const LEVEL_TEXT = { positive: 'text-positive', caution: 'text-caution', negative: 'text-negative' };

/**
 * Página privada `/app/insights`: consejos generados por IA a partir de los totales por
 * categoría (FT-0007, REQ-020 y REQ-021) y un chat con el asistente financiero. Desde la primera
 * semana compara semana contra semana y desde el primer mes, mes contra mes. Sin una semana de
 * historial muestra el mes hasta hoy en vez de consejos, pero el chat funciona desde el primer día;
 * si la IA no responde, deja reintentar. En pantallas anchas el chat va a la derecha.
 */
export default function Insights() {
  usePageTitle('Consejos');
  const online = useOnlineStatus();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null); // { code, message }
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0); // se incrementa para volver a pedirlos

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInsights()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => !cancelled && setError({ code: err.code, message: err.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const retry = useCallback(() => setVersion((v) => v + 1), []);
  // Sin una semana de historial no hay consejos con IA: se muestra el mes hasta hoy, calculado aquí.
  const noHistory = error?.code === 'INSUFFICIENT_HISTORY';
  const mobile = useMediaQuery('(width < 48rem)');
  const [panel, setPanel] = useState(null); // null | 'detail' | 'chat'
  const analytics = useAsync(() => (mobile ? getAnalytics() : Promise.resolve(null)), [mobile]);

  if (mobile) {
    const health = analytics.data && !analytics.data.empty ? analytics.data.health : null;
    return (
      <>
        <h1 className="text-[28px] font-semibold tracking-tight">Consejos</h1>

        <button
          type="button"
          onClick={() => setPanel('detail')}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-ink/10 bg-surface p-3.5 text-left focus-visible:outline-2 focus-visible:outline-violet"
        >
          <span className="grid size-[60px] shrink-0 place-items-center rounded-2xl bg-ink/5 text-2xl font-semibold tabular-nums">
            {health ? health.score : '–'}
          </span>
          <span className="min-w-0 flex-1 text-[15px]">
            <span className="block text-ink/70">Salud financiera</span>
            <strong className={cn('mt-0.5 block text-lg font-semibold', health && LEVEL_TEXT[LEVELS[health.level].tone])}>
              {health ? LEVELS[health.level].label : 'Tu mes en números'}
            </strong>
          </span>
          <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
        </button>

        <section aria-labelledby="insights-title" className="mt-6" aria-busy={loading}>
          <h2 id="insights-title" className="text-lg font-semibold tracking-tight first-letter:uppercase">
            {data ? (data.period === 'week' ? 'Esta semana' : formatMonth(data.month)) : 'Este mes'}
          </h2>
          {loading && !data ? (
            <p className="flex items-center gap-2 py-6 text-ink/60">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Analizando tus movimientos…
            </p>
          ) : noHistory ? (
            <div className="mt-2">
              <MonthHighlights message={error.message} />
            </div>
          ) : error ? (
            <p role="alert" className="py-3 text-sm text-negative">
              {!online
                ? 'Sin conexión. Los insights necesitan internet; vuelve a intentarlo cuando regreses.'
                : error.code === 'AI_UNAVAILABLE'
                  ? 'Nuestro asistente no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.'
                  : error.message}{' '}
              <button type="button" className="underline" onClick={retry}>
                Reintentar
              </button>
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2.5">
              {data.insights.map((insight) => (
                <li key={`${insight.type}-${insight.title}`} className="rounded-2xl border border-ink/10 bg-surface p-3.5">
                  <h3 className="text-[15px] font-semibold">{insight.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-ink/70">{insight.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pendiente" className="mt-6">
          <h2 id="pendiente" className="text-lg font-semibold tracking-tight">
            Para tener en cuenta
          </h2>
          <Link
            to="/app/renta"
            className="mt-2 flex min-h-16 items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-3.5 py-2.5 focus-visible:outline-2 focus-visible:outline-violet"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Landmark className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Renta y DIAN</span>
              <span className="block text-[13px] text-ink/70">Averigua si te toca declarar y cuándo</span>
            </span>
            <ChevronRight className="size-[18px] shrink-0 text-ink/60" aria-hidden="true" />
          </Link>
        </section>

        <button
          type="button"
          onClick={() => setPanel('chat')}
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full border border-ink/15 bg-surface py-1.5 pl-4 pr-1.5 text-left shadow-lg focus-visible:outline-2 focus-visible:outline-violet"
        >
          <span className="min-w-0 flex-1 text-base text-ink/60">Pregunta sobre tu plata</span>
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white">
            <ArrowUp className="size-5" />
          </span>
        </button>

        <Sheet open={panel === 'detail'} title="Tu mes en números" onClose={() => setPanel(null)}>
          <MonthAnalytics />
        </Sheet>
        <Sheet open={panel === 'chat'} title="Pregúntale a FinTrack" onClose={() => setPanel(null)}>
          <AssistantChat embedded className="border-0 bg-transparent p-0 md:p-0" />
        </Sheet>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Consejos"
        description="Consejos de la semana o del mes y un asistente para tus preguntas. Solo usa totales por categoría, nunca tus descripciones."
      />

      <MonthAnalytics />

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Panel aria-labelledby="insights-title">
          <h2 id="insights-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-5 text-brand" aria-hidden="true" />
            <span className="first-letter:uppercase">
              {data ? insightsTitle(data) : noHistory ? `${new Date().toLocaleDateString('es-CO', { month: 'long' })}, hasta hoy` : 'Este mes'}
            </span>
          </h2>

          <div className="mt-5" aria-busy={loading}>
            {loading && !data ? (
              <p className="flex items-center gap-2 py-10 text-ink/60">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Analizando tus movimientos…
              </p>
            ) : noHistory ? (
              <MonthHighlights message={error.message} />
            ) : error ? (
              <p role="alert" className="py-4 text-sm text-negative">
                {!online
                  ? 'Sin conexión. Los insights necesitan internet; vuelve a intentarlo cuando regreses.'
                  : error.code === 'AI_UNAVAILABLE'
                    ? 'Nuestro asistente no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.'
                    : error.message}{' '}
                <button type="button" className="underline" onClick={retry}>
                  Reintentar
                </button>
              </p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {data.insights.map((insight) => (
                  <li key={`${insight.type}-${insight.title}`}>
                    <InsightCard insight={insight} className="h-full" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <AssistantChat className="xl:sticky xl:top-6" />
      </div>
    </>
  );
}
