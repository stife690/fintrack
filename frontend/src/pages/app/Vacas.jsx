import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, KeyRound, Loader2, PiggyBank, Plus, Users } from 'lucide-react';
import JoinByCode from '@/components/common/JoinByCode';
import Sheet from '@/components/common/Sheet';
import GroupSwitch from '@/components/layout/GroupSwitch';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import VacaForm from '@/components/vacas/VacaForm';
import VacaProgress from '@/components/vacas/VacaProgress';
import { MEMBER_STATUS, VACA_STATUS, deadlineText, formatPercent, formatPesos } from '@/components/vacas/vacaFormat';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { createVaca, listVacas } from '@/services/vacaService';

/**
 * Tarjeta de una vaca en la lista: avance del grupo y lo que le falta al usuario.
 * @param {{ vaca: import('@/services/vacaService').Vaca }} props
 */
function VacaCard({ vaca }) {
  const status = VACA_STATUS[vaca.status];
  const mine = MEMBER_STATUS[vaca.myStatus];
  return (
    <li className="min-w-0">
      <Link
        to={`/app/vacas/${vaca.id}`}
        className="group block rounded-2xl border border-ink/10 bg-surface p-4 transition-colors hover:border-brand/40 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words font-semibold tracking-tight sm:text-lg">{vaca.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink/60">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" /> {vaca.membersCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden="true" /> {deadlineText(vaca, { withDate: false })}
              </span>
            </p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', status.chip)}>{status.label}</span>
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5 tabular-nums text-ink/60">
          <span className="text-2xl font-semibold tracking-tight text-ink">{formatPesos(vaca.total)}</span>
          <span className="text-sm">de {formatPesos(vaca.goal)}</span>
        </p>
        <div className="mt-2">
          <VacaProgress
            value={vaca.percentage}
            barClass={status.bar}
            label={`Avance de ${vaca.name}`}
            valueText={`${formatPercent(vaca.percentage)}: ${formatPesos(vaca.total)} de ${formatPesos(vaca.goal)}`}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <p className="min-w-0 text-ink/60">
            Tu parte:{' '}
            <span className="font-medium tabular-nums text-ink">
              {formatPesos(vaca.myContributed)} de {formatPesos(vaca.myQuota)}
            </span>
          </p>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', mine.chip)}>{mine.label}</span>
        </div>
      </Link>
    </li>
  );
}

/**
 * Página privada `/app/vacas` (FT-0014): las vacas del usuario. Crear una y unirse con un código
 * se abren en una ventana para que la página muestre solo la lista. Sin conexión muestra la
 * última lista guardada en el dispositivo.
 */
export default function Vacas() {
  usePageTitle('Vacas');
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [vacas, setVacas] = useState(null);
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [sheet, setSheet] = useState(null); // 'nueva' | 'codigo' | null
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const queue = await import('@/offline/vacaQueue');
      try {
        const data = await listVacas();
        if (cancelled) return;
        setVacas(data);
        setFromCache(false);
        setError('');
        queue.cacheVacaList(data).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        const cached = await queue.getCachedVacaList().catch(() => null);
        if (cancelled) return;
        if (cached) {
          setVacas(cached);
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
    const vaca = await createVaca(values);
    navigate(`/app/vacas/${vaca.id}`, { state: { created: true } });
  };

  return (
    <>
      <GroupSwitch />
      <PageHeader
        title="Vacas"
        description="Junten plata en grupo para una meta."
        actions={
          <>
            <Button onClick={() => setSheet('nueva')} disabled={!online}>
              <Plus aria-hidden="true" /> Nueva vaca
            </Button>
            <Button variant="ghost" onClick={() => setSheet('codigo')} disabled={!online}>
              <KeyRound aria-hidden="true" /> Tengo un código
            </Button>
          </>
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

      {vacas === null && !error ? (
        <p className="flex items-center gap-2 py-10 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      ) : vacas?.length === 0 ? (
        <Panel className="mx-auto max-w-xl text-center">
          <PiggyBank className="mx-auto size-10 text-brand" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold">Aún no tienes vacas</p>
          <p className="mx-auto mt-1 max-w-md text-ink/60">
            Crea una para el paseo, el regalo o el mercado del mes e invita a los demás. FinTrack reparte la meta y les
            dice si van a tiempo.
          </p>
          <Button className="mt-4" onClick={() => setSheet('nueva')} disabled={!online}>
            Crear mi primera vaca
          </Button>
        </Panel>
      ) : (
        vacas && (
          <ul aria-label="Mis vacas" className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {vacas.map((vaca) => (
              <VacaCard key={vaca.id} vaca={vaca} />
            ))}
          </ul>
        )
      )}

      <Sheet open={sheet === 'nueva'} title="Nueva vaca" onClose={() => setSheet(null)}>
        <VacaForm disabled={!online} onSubmit={handleCreate} onCancel={() => setSheet(null)} />
      </Sheet>
      <Sheet
        open={sheet === 'codigo'}
        title="Unirme a una vaca"
        description="Escribe el código que te compartieron."
        onClose={() => setSheet(null)}
      >
        <JoinByCode basePath="/app/vacas" disabled={!online} />
      </Sheet>
    </>
  );
}
