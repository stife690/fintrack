import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight, KeyRound, Loader2, Plus, Users } from 'lucide-react';
import JoinByCode from '@/components/common/JoinByCode';
import Sheet from '@/components/common/Sheet';
import GroupSwitch from '@/components/layout/GroupSwitch';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import NegocioForm from '@/components/negocios/NegocioForm';
import { ROLES, formatShare } from '@/components/negocios/negocioFormat';
import { Button } from '@/components/ui/button';
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
    <li className="min-w-0">
      <Link
        to={`/app/negocios/${business.id}`}
        className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4 transition-colors hover:border-brand/40 sm:gap-4 sm:p-5"
      >
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Briefcase className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words font-semibold tracking-tight sm:text-lg">{business.name}</p>
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
 * Página privada `/app/negocios` (FT-0016): los emprendimientos del usuario. Crear uno y unirse
 * con un código se abren en una ventana. Cada negocio lo comparten varios socios y sus finanzas
 * van aparte de las personales.
 */
export default function Negocios() {
  usePageTitle('Negocios');
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null); // 'nuevo' | 'codigo' | null
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
      <GroupSwitch />
      <PageHeader
        title="Negocios"
        description="Las cuentas de tus emprendimientos, con tus socios."
        actions={
          <>
            <Button onClick={() => setSheet('nuevo')} disabled={!online}>
              <Plus aria-hidden="true" /> Nuevo negocio
            </Button>
            <Button variant="ghost" onClick={() => setSheet('codigo')} disabled={!online}>
              <KeyRound aria-hidden="true" /> Tengo un código
            </Button>
          </>
        }
      />

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
        <Panel className="mx-auto max-w-xl text-center">
          <Briefcase className="mx-auto size-10 text-brand" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold">Aún no tienes negocios</p>
          <p className="mx-auto mt-1 max-w-md text-ink/60">
            Crea uno para tu emprendimiento e invita a tus socios: cada uno con su rol y su participación. Sus finanzas
            quedan aparte de las tuyas.
          </p>
          <Button className="mt-4" onClick={() => setSheet('nuevo')} disabled={!online}>
            Crear mi primer negocio
          </Button>
        </Panel>
      ) : (
        businesses && (
          <ul aria-label="Mis negocios" className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </ul>
        )
      )}

      <Sheet open={sheet === 'nuevo'} title="Nuevo negocio" onClose={() => setSheet(null)}>
        <NegocioForm disabled={!online} onSubmit={handleCreate} onCancel={() => setSheet(null)} />
      </Sheet>
      <Sheet
        open={sheet === 'codigo'}
        title="Unirme a un negocio"
        description="Escribe el código que te compartió un socio."
        onClose={() => setSheet(null)}
      >
        <JoinByCode basePath="/app/negocios" disabled={!online} />
      </Sheet>
    </>
  );
}
