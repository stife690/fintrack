import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, LogOut, Pencil, Trash2 } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import PageHeader from '@/components/layout/PageHeader';
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
 * Página privada `/app/negocios/:id` (FT-0016): un negocio con sus socios. Los dueños invitan,
 * cambian roles y participaciones y editan los datos; cualquier socio puede salirse.
 * Se vuelve a pedir al regresar a la pestaña, para ver los cambios de los demás socios.
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
    state?.created
      ? 'Negocio creado. Invita a tus socios con el enlace, el código o por correo.'
      : state?.joined
        ? '¡Ya eres socio del negocio!'
        : '',
  );
  const [editing, setEditing] = useState(false);
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

  return (
    <>
      <Link
        to="/app/negocios"
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Mis negocios
      </Link>
      <PageHeader
        title={business.name}
        description={[business.description, business.nit && `NIT ${business.nit}`].filter(Boolean).join(' · ') || undefined}
        actions={
          <span className={cn('rounded-full px-3 py-1 text-sm font-medium', role.chip)}>
            {role.label}
            {business.myShare !== null && ` · ${formatShare(business.myShare)}`}
          </span>
        }
      />

      <p role="status" className="-mt-3 mb-3 min-h-5 text-sm text-positive">
        {notice}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel aria-labelledby="partners-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="partners-title" className="text-lg font-semibold tracking-tight">
                Socios ({business.membersCount})
              </h2>
              {business.totalShare > 0 && (
                <p className="text-sm tabular-nums text-ink/60">
                  Participación asignada: {formatShare(business.totalShare)}
                </p>
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

          <Panel aria-labelledby="roles-title">
            <h2 id="roles-title" className="mb-3 text-lg font-semibold tracking-tight">
              Quién puede hacer qué
            </h2>
            <dl className="divide-y divide-ink/10">
              {Object.entries(ROLES).map(([key, { label, hint, chip }]) => (
                <div key={key} className="flex items-center gap-3 py-2.5">
                  <dt className="w-16 shrink-0">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', chip)}>{label}</span>
                  </dt>
                  <dd className="text-sm text-ink/70">{hint}.</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          {isOwner && (
            <Panel aria-labelledby="invite-title">
              <h2 id="invite-title" className="mb-4 text-lg font-semibold tracking-tight">
                Invitar socios
              </h2>
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
                  setNotice('Código cambiado: comparte el enlace nuevo.');
                }}
              />
            </Panel>
          )}

          <Panel aria-labelledby="settings-title">
            <h2 id="settings-title" className="mb-3 text-lg font-semibold tracking-tight">
              Ajustes
            </h2>
            {editing ? (
              <NegocioForm
                initial={business}
                disabled={!online}
                onSubmit={(values) =>
                  apply(() => updateBusiness(id, values), 'Cambios guardados.').then(() => setEditing(false))
                }
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="flex flex-col gap-1">
                {isOwner && (
                  <Button variant="ghost" className="justify-start" disabled={!online} onClick={() => setEditing(true)}>
                    <Pencil aria-hidden="true" /> Editar el negocio
                  </Button>
                )}
                {!sole && (
                  <ConfirmButton
                    label="Salirme del negocio"
                    question={
                      isOwner && business.partners.filter((p) => p.role === 'dueno').length === 1
                        ? 'Eres el único dueño: antes de salirte, hazle dueño a otro socio.'
                        : 'Dejarás de ver el negocio. Un dueño puede volver a invitarte.'
                    }
                    confirmLabel="Sí, salirme"
                    icon={LogOut}
                    disabled={!online}
                    onConfirm={leave}
                  />
                )}
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
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
