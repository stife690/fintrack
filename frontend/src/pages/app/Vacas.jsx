import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2, PiggyBank, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VacaForm from '@/components/vacas/VacaForm';
import VacaProgress from '@/components/vacas/VacaProgress';
import { MEMBER_STATUS, VACA_STATUS, deadlineText, formatPercent } from '@/components/vacas/vacaFormat';
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
    <li>
      <Link
        to={`/app/vacas/${vaca.id}`}
        className="block rounded-2xl border border-ink/10 bg-surface p-5 transition-colors hover:border-brand/40 hover:bg-brand-soft/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight">{vaca.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink/60">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" /> {vaca.membersCount}
              </span>
              <span>· {deadlineText(vaca)}</span>
            </p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', status.chip)}>
            {status.label}
          </span>
        </div>

        <p className="mt-4 tabular-nums text-ink/60">
          <span className="text-2xl font-semibold text-ink">{formatMoney(vaca.total)}</span> de{' '}
          {formatMoney(vaca.goal)}
        </p>
        <div className="mt-2">
          <VacaProgress
            value={vaca.percentage}
            barClass={status.bar}
            label={`Avance de ${vaca.name}`}
            valueText={`${formatPercent(vaca.percentage)}: ${formatMoney(vaca.total)} de ${formatMoney(vaca.goal)}`}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <p className="text-ink/60">
            Tu parte:{' '}
            <span className="font-medium tabular-nums text-ink">
              {formatMoney(vaca.myContributed)} de {formatMoney(vaca.myQuota)}
            </span>{' '}
            <span className={cn('ml-1 rounded-full px-2 py-0.5 text-xs font-medium', mine.chip)}>{mine.label}</span>
          </p>
          <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}

/**
 * Unirse con un código que alguien compartió (lleva a la vista previa de la invitación).
 * @param {{ disabled: boolean }} props
 */
function JoinByCode({ disabled }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const clean = code.trim().toUpperCase();
  const valid = /^[A-Z0-9]{4,8}$/.test(clean);

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) navigate(`/app/vacas/unirse/${clean}`);
      }}
    >
      <label htmlFor="join-code" className="text-sm font-medium text-ink/80">
        ¿Te pasaron un código?
      </label>
      <div className="flex gap-2">
        <Input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ej. K7M2QX"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={8}
          className="font-mono uppercase tracking-widest"
          disabled={disabled}
        />
        <Button type="submit" className="h-12 shrink-0" disabled={disabled || !valid}>
          Unirme
        </Button>
      </div>
    </form>
  );
}

/**
 * Página privada `/app/vacas` (FT-0014): las vacas del usuario, crear una nueva y unirse con un
 * código. Sin conexión muestra la última lista guardada en el dispositivo.
 */
export default function Vacas() {
  usePageTitle('Vacas');
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [vacas, setVacas] = useState(null);
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
      <PageHeader
        title="Vacas"
        description="Junten plata en grupo para una meta: cada quien ve cuánto lleva y cuánto le falta."
        actions={
          !creating && (
            <Button onClick={() => setCreating(true)} disabled={!online}>
              <PiggyBank aria-hidden="true" /> Nueva vaca
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="vacas-title" className="min-w-0">
          <h2 id="vacas-title" className="sr-only">
            Mis vacas
          </h2>
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
            <Panel className="text-center">
              <PiggyBank className="mx-auto size-10 text-brand" aria-hidden="true" />
              <p className="mt-3 text-lg font-semibold">Aún no tienes vacas</p>
              <p className="mx-auto mt-1 max-w-md text-ink/60">
                Crea una para el paseo, el regalo o el mercado del mes e invita a tu familia o amigos. FinTrack
                reparte la meta y les dice si van a tiempo.
              </p>
              {!creating && (
                <Button className="mt-4" onClick={() => setCreating(true)} disabled={!online}>
                  Crear mi primera vaca
                </Button>
              )}
            </Panel>
          ) : (
            vacas && (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {vacas.map((vaca) => (
                  <VacaCard key={vaca.id} vaca={vaca} />
                ))}
              </ul>
            )
          )}
        </section>

        <div className="flex flex-col gap-6">
          {creating && (
            <Panel aria-labelledby="new-vaca-title">
              <h2 id="new-vaca-title" className="mb-5 text-lg font-semibold tracking-tight">
                Nueva vaca
              </h2>
              <VacaForm disabled={!online} onSubmit={handleCreate} onCancel={() => setCreating(false)} />
            </Panel>
          )}
          <Panel aria-label="Unirse a una vaca">
            <JoinByCode disabled={!online} />
            {!online && <p className="mt-2 text-sm text-ink/60">Necesitas conexión para crear o unirte a una vaca.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
