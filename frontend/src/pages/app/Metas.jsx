import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, Flag, Loader2, Plus } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import VacaForm from '@/components/vacas/VacaForm';
import VacaProgress from '@/components/vacas/VacaProgress';
import { VACA_STATUS, deadlineText, formatPercent, formatPesos } from '@/components/vacas/vacaFormat';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { createVaca, listVacas } from '@/services/vacaService';

/** Una meta es una vaca de una sola persona; las vacas en grupo salen en `/app/vacas`. */
const isPersonal = (vaca) => Boolean(vaca.personal);

/**
 * Tarjeta de una meta: cuánto lleva, cuánto le falta y si va a tiempo.
 * @param {{ meta: import('@/services/vacaService').Vaca }} props
 */
function MetaCard({ meta }) {
  const status = VACA_STATUS[meta.status];
  return (
    <li className="min-w-0">
      <Link
        to={`/app/metas/${meta.id}`}
        className="group block rounded-2xl border border-ink/10 bg-surface p-4 transition-colors hover:border-brand/40 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words font-semibold tracking-tight sm:text-lg">{meta.name}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-ink/60">
              <CalendarClock className="size-3.5" aria-hidden="true" /> {deadlineText(meta, { withDate: false })}
            </p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', status.chip)}>
            {status.label}
          </span>
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5 tabular-nums text-ink/60">
          <span className="text-2xl font-semibold tracking-tight text-ink">{formatPesos(meta.total)}</span>
          <span className="text-sm">de {formatPesos(meta.goal)}</span>
        </p>
        <div className="mt-2">
          <VacaProgress
            value={meta.percentage}
            barClass={status.bar}
            label={`Avance de ${meta.name}`}
            valueText={`${formatPercent(meta.percentage)}: ${formatPesos(meta.total)} de ${formatPesos(meta.goal)}`}
          />
        </div>
        <p className="mt-3 text-sm text-ink/60">
          {meta.projection.remaining > 0 ? (
            <>
              Te faltan{' '}
              <span className="font-medium tabular-nums text-ink">{formatPesos(meta.projection.remaining)}</span>
            </>
          ) : (
            'Ya completaste la meta'
          )}
        </p>
      </Link>
    </li>
  );
}

/**
 * Página privada `/app/metas`: metas de ahorro personales (la moto, el semestre, un viaje). Por
 * dentro son vacas de una sola persona, sin invitaciones ni cuotas: aportar deja el gasto de ahorro
 * en los movimientos y saca la plata del saldo disponible. Sin conexión muestra la última lista.
 */
export default function Metas() {
  usePageTitle('Metas');
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [metas, setMetas] = useState(null);
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const queue = await import('@/offline/vacaQueue');
      try {
        // La lista guardada en el dispositivo es la misma de Vacas: se pide completa y se filtra.
        const data = await listVacas();
        if (cancelled) return;
        setMetas(data.filter(isPersonal));
        setFromCache(false);
        setError('');
        queue.cacheVacaList(data).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        const cached = await queue.getCachedVacaList().catch(() => null);
        if (cancelled) return;
        if (cached) {
          setMetas(cached.filter(isPersonal));
          setFromCache(true);
        } else {
          setError(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version, online]);

  const handleCreate = async (values) => {
    const meta = await createVaca({ ...values, personal: true });
    navigate(`/app/metas/${meta.id}`, { state: { created: true } });
  };

  return (
    <>
      <PageHeader
        title="Metas"
        description="Ahorra para lo tuyo, a tu ritmo. Cada aporte se aparta de tu saldo."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!online}>
            <Plus aria-hidden="true" /> Nueva meta
          </Button>
        }
      />

      {fromCache && (
        <p className="mb-3 text-sm text-ink/60">Sin conexión: es la última lista guardada en este dispositivo.</p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={reload}>
            Reintentar
          </button>
        </p>
      )}

      {metas === null && !error ? (
        <p className="flex items-center gap-2 py-10 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      ) : metas?.length === 0 ? (
        <Panel className="mx-auto max-w-xl text-center">
          <Flag className="mx-auto size-10 text-brand" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold">Aún no tienes metas</p>
          <p className="mx-auto mt-1 max-w-md text-ink/60">
            Ponle nombre y valor a lo que quieres (la moto, el semestre, un viaje) y ve apartando plata. FinTrack te
            dice si vas a tiempo.
          </p>
          <Button className="mt-4" onClick={() => setCreating(true)} disabled={!online}>
            Crear mi primera meta
          </Button>
        </Panel>
      ) : (
        metas && (
          <ul aria-label="Mis metas" className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {metas.map((meta) => (
              <MetaCard key={meta.id} meta={meta} />
            ))}
          </ul>
        )
      )}

      <Sheet open={creating} title="Nueva meta" onClose={() => setCreating(false)}>
        <VacaForm personal disabled={!online} onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Sheet>
    </>
  );
}
