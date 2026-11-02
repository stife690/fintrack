import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight, Loader2, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import NegocioForm from '@/components/negocios/NegocioForm';
import { ROLES, formatShare } from '@/components/negocios/negocioFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { createBusiness, listBusinesses } from '@/services/negocioService';

/**
 * Tarjeta de un negocio en la lista: socios, rol y participación del usuario.
 * @param {{ business: import('@/services/negocioService').Business }} props
 */
function BusinessCard({ business }) {
  const role = ROLES[business.role];
  return (
    <li>
      <Link
        to={`/app/negocios/${business.id}`}
        className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-surface p-5 transition-colors hover:border-brand/40 hover:bg-brand-soft/20"
      >
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Briefcase className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold tracking-tight">{business.name}</p>
          {business.description && <p className="truncate text-sm text-ink/60">{business.description}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/60">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden="true" /> {business.membersCount}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', role.chip)}>{role.label}</span>
            {business.myShare !== null && <span className="tabular-nums">{formatShare(business.myShare)}</span>}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
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
        if (valid) navigate(`/app/negocios/unirse/${clean}`);
      }}
    >
      <label htmlFor="negocio-join-code" className="text-sm font-medium text-ink/80">
        ¿Un socio te pasó un código?
      </label>
      <div className="flex gap-2">
        <Input
          id="negocio-join-code"
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
 * Página privada `/app/negocios` (FT-0016): los emprendimientos del usuario, crear uno nuevo y
 * unirse con un código. Cada negocio lo comparten varios socios y sus finanzas van aparte de las
 * personales.
 */
export default function Negocios() {
  usePageTitle('Negocios');
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setError('');
    listBusinesses()
      .then((data) => !cancelled && setBusinesses(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [version, online]);

  const handleCreate = async (values) => {
    const business = await createBusiness(values);
    navigate(`/app/negocios/${business.id}`, { state: { created: true } });
  };

  return (
    <>
      <PageHeader
        title="Negocios"
        description="Lleva las cuentas de tus emprendimientos con tus socios, separadas de tus finanzas personales."
        actions={
          !creating && (
            <Button onClick={() => setCreating(true)} disabled={!online}>
              <Briefcase aria-hidden="true" /> Nuevo negocio
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="negocios-title" className="min-w-0">
          <h2 id="negocios-title" className="sr-only">
            Mis negocios
          </h2>
          {error && (
            <p role="alert" className="mb-3 text-sm text-negative">
              {online ? error : 'Sin conexión: los negocios se ven con internet.'}{' '}
              {online && (
                <button type="button" className="underline" onClick={reload}>
                  Reintentar
                </button>
              )}
            </p>
          )}
          {businesses === null && !error ? (
            <p className="flex items-center gap-2 py-10 text-ink/60">
              <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
            </p>
          ) : businesses?.length === 0 ? (
            <Panel className="text-center">
              <Briefcase className="mx-auto size-10 text-brand" aria-hidden="true" />
              <p className="mt-3 text-lg font-semibold">Aún no tienes negocios</p>
              <p className="mx-auto mt-1 max-w-md text-ink/60">
                Crea uno para tu emprendimiento e invita a tus socios: cada uno con su rol y su participación.
              </p>
              {!creating && (
                <Button className="mt-4" onClick={() => setCreating(true)} disabled={!online}>
                  Crear mi primer negocio
                </Button>
              )}
            </Panel>
          ) : (
            businesses && (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {businesses.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </ul>
            )
          )}
        </section>

        <div className="flex flex-col gap-6">
          {creating && (
            <Panel aria-labelledby="new-negocio-title">
              <h2 id="new-negocio-title" className="mb-5 text-lg font-semibold tracking-tight">
                Nuevo negocio
              </h2>
              <NegocioForm disabled={!online} onSubmit={handleCreate} onCancel={() => setCreating(false)} />
            </Panel>
          )}
          <Panel aria-label="Unirse a un negocio">
            <JoinByCode disabled={!online} />
            {!online && <p className="mt-2 text-sm text-ink/60">Necesitas conexión para crear o unirte a un negocio.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
