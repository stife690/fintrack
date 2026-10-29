import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import AssistantChat from '@/components/insights/AssistantChat';
import InsightCard from '@/components/insights/InsightCard';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatMonth } from '@/components/budgets/month';
import { Button } from '@/components/ui/button';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { getInsights } from '@/services/insightService';

/**
 * Página privada `/app/insights`: consejos del mes generados por IA a partir de los totales por
 * categoría (FT-0007, REQ-020 y REQ-021) y un chat con el asistente financiero. Sin un mes de
 * historial muestra un aviso en vez de consejos, pero el chat funciona desde el primer día; si la
 * IA no responde, deja reintentar. En pantallas anchas el chat va a la derecha.
 */
export default function Insights() {
  usePageTitle('Insights');
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

  return (
    <>
      <PageHeader
        title="Insights"
        description="Consejos del mes y un asistente para tus preguntas. Solo usa totales por categoría, nunca tus descripciones."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Panel aria-labelledby="insights-title">
          <h2 id="insights-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-5 text-brand" aria-hidden="true" />
            <span className="first-letter:uppercase">{data ? formatMonth(data.month) : 'Este mes'}</span>
          </h2>

          <div className="mt-5" aria-busy={loading}>
            {loading && !data ? (
              <p className="flex items-center gap-2 py-10 text-ink/60">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Analizando tus movimientos…
              </p>
            ) : error?.code === 'INSUFFICIENT_HISTORY' ? (
              <div className="py-6 text-center">
                <p className="font-medium">Todavía no hay suficiente historial</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-ink/70">{error.message}</p>
                <Button asChild className="mt-4">
                  <Link to="/app/transacciones">Registrar un movimiento</Link>
                </Button>
              </div>
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
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {data.insights.map((insight) => (
                  <li key={`${insight.type}-${insight.title}`}>
                    <InsightCard insight={insight} className="h-full" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <AssistantChat className="lg:sticky lg:top-6" />
      </div>
    </>
  );
}
