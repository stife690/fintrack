import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, LogOut, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import Panel from '@/components/layout/Panel';
import NegocioForm from '@/components/negocios/NegocioForm';
import NegocioInvitePanel from '@/components/negocios/NegocioInvitePanel';
import PartnerList from '@/components/negocios/PartnerList';
import { ROLES, formatShare } from '@/components/negocios/negocioFormat';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import {
  cancelInvitation,
  deleteBusiness,
  getBusiness,
  inviteByEmail,
  regenerateCode,
  removePartner,
  updateBusiness,
  updatePartner,
} from '@/services/negocioService';

/**
 * Página privada `/app/negocios/:id` (FT-0016): un negocio con sus socios. Los dueños invitan
 * (ventana), cambian roles y participaciones desde cada socio y editan el negocio en Opciones;
 * cualquier socio puede salirse. Se vuelve a pedir al regresar a la pestaña, para ver los cambios
 * de los demás socios.
 */
export default function NegocioDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState('');
  const [gone, setGone] = useState(false);
  const [notice, setNotice] = useState(
    state?.created ? 'Negocio creado. Invita a tus socios.' : state?.joined ? '¡Ya eres socio del negocio!' : '',
  );
  const [sheet, setSheet] = useState(state?.created ? 'invitar' : null); // 'invitar' | 'opciones' | 'editar'
  usePageTitle(business?.name ?? 'Negocio');

  const load = useCallback(async () => {
    try {
      setBusiness(await getBusiness(id));
      setError('');
    } catch (err) {
      if (err.code === 'NOT_FOUND') setGone(true);
      else setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setBusiness(null);
    setGone(false);
    load();
  }, [load]);

  useEffect(() => {
    if (!online) return undefined;
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [online, load]);

  /** Ejecuta una acción que devuelve el negocio actualizado y lo pinta. */
  const apply = async (action, message) => {
    const updated = await action();
    if (updated) setBusiness(updated);
    setNotice(message ?? '');
  };

  const leave = async () => {
    await removePartner(id, user.id);
    navigate('/app/negocios', { replace: true });
  };

  const remove = async () => {
    await deleteBusiness(id);
    navigate('/app/negocios', { replace: true });
  };

  if (gone) {
    return (
      <Panel className="mx-auto max-w-lg text-center">
        <p className="text-lg font-semibold">Este negocio ya no está disponible</p>
        <p className="mt-1 text-ink/60">Se eliminó o ya no eres socio.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/app/negocios">Ir a mis negocios</Link>
        </Button>
      </Panel>
    );
  }

  if (!business) {
    return error ? (
      <p role="alert" className="text-negative">
        {online ? error : 'Sin conexión: el negocio se ve con internet.'}{' '}
        <button type="button" className="underline" onClick={load}>
          Reintentar
        </button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-10 text-ink/60">
        <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  }

  const isOwner = business.role === 'dueno';
  const role = ROLES[business.role];
  const sole = business.membersCount === 1;
  const lastOwner = isOwner && business.partners.filter((p) => p.role === 'dueno').length === 1;
  const closeSheet = () => setSheet(null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/negocios"
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Mis negocios
      </Link>

      <header className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">{business.name}</h1>
          {business.description && <p className="mt-1 break-words text-ink/60">{business.description}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/60">
            <span className={cn('rounded-full px-2.5 py-0.5 font-medium', role.chip)}>
              {role.label}
              {business.myShare !== null && ` · ${formatShare(business.myShare)}`}
            </span>
            {business.nit && <span className="break-all">NIT {business.nit}</span>}
          </p>
        </div>
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => setSheet('opciones')} aria-label="Opciones del negocio">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </header>

      <p role="status" className={cn('text-sm text-positive', notice && 'mb-4')}>
        {notice}
      </p>

      <Panel aria-labelledby="partners-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="partners-title" className="text-lg font-semibold tracking-tight">
              Socios ({business.membersCount})
            </h2>
            <p className="text-sm text-ink/60">
              {isOwner
                ? business.totalShare > 0
                  ? `${formatShare(business.totalShare)} de la participación asignada`
                  : 'Toca ⋮ en un socio para cambiar su rol o su participación.'
                : `Eres ${role.label.toLowerCase()}: ${role.hint.toLowerCase()}.`}
            </p>
          </div>
          {isOwner && (
            <Button onClick={() => setSheet('invitar')}>
              <UserPlus aria-hidden="true" /> Invitar
            </Button>
          )}
        </div>
        <PartnerList
          partners={business.partners}
          isOwner={isOwner}
          online={online}
          onUpdate={(userId, changes) => apply(() => updatePartner(id, userId, changes), 'Socio actualizado.')}
          onRemove={async (userId) => {
            await removePartner(id, userId);
            setNotice('Socio retirado del negocio.');
            await load();
          }}
        />
      </Panel>

      {isOwner && (
        <Sheet open={sheet === 'invitar'} title="Invitar socios" onClose={closeSheet}>
          <NegocioInvitePanel
            business={business}
            online={online}
            onInvite={async (email, inviteRole) => {
              const result = await inviteByEmail(id, email, inviteRole);
              load();
              return result;
            }}
            onCancelInvitation={async (email) => {
              await cancelInvitation(id, email);
              await load();
            }}
            onRegenerate={async () => {
              const { code } = await regenerateCode(id);
              setBusiness((current) => ({ ...current, code }));
            }}
          />
        </Sheet>
      )}

      <Sheet open={sheet === 'editar'} title="Editar el negocio" onClose={closeSheet}>
        <NegocioForm
          initial={business}
          disabled={!online}
          onSubmit={(values) => apply(() => updateBusiness(id, values), 'Cambios guardados.').then(closeSheet)}
          onCancel={closeSheet}
        />
      </Sheet>

      <Sheet open={sheet === 'opciones'} title="Opciones del negocio" onClose={closeSheet}>
        <div className="flex flex-col gap-1">
          {isOwner && (
            <Button variant="ghost" className="justify-start" disabled={!online} onClick={() => setSheet('editar')}>
              <Pencil aria-hidden="true" /> Editar nombre, descripción y NIT
            </Button>
          )}
          {!sole &&
            (lastOwner ? (
              <p className="flex items-start gap-2 px-4 py-2 text-sm text-ink/60">
                <LogOut className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Para salirte, primero hazle dueño a otro socio: eres el único.
              </p>
            ) : (
              <ConfirmButton
                label="Salirme del negocio"
                question="Dejarás de ver el negocio. Un dueño puede volver a invitarte."
                confirmLabel="Sí, salirme"
                icon={LogOut}
                disabled={!online}
                onConfirm={leave}
              />
            ))}
          {isOwner && (
            <ConfirmButton
              label="Eliminar el negocio"
              question="Se borra para todos los socios y no se puede deshacer."
              confirmLabel="Sí, eliminar"
              icon={Trash2}
              disabled={!online}
              onConfirm={remove}
            />
          )}
          {!online && <p className="mt-1 text-sm text-ink/60">Necesitas conexión para cambiar el negocio.</p>}
        </div>
      </Sheet>
    </div>
  );
}
