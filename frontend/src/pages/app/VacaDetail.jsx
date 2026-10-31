import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, LogOut, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatDate, formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import AdviceCard from '@/components/vacas/AdviceCard';
import ContributionForm from '@/components/vacas/ContributionForm';
import ContributionList from '@/components/vacas/ContributionList';
import InvitePanel from '@/components/vacas/InvitePanel';
import MemberList from '@/components/vacas/MemberList';
import VacaForm from '@/components/vacas/VacaForm';
import VacaProgress from '@/components/vacas/VacaProgress';
import { MEMBER_STATUS, VACA_STATUS, deadlineText, formatPercent } from '@/components/vacas/vacaFormat';
import { useAuth } from '@/auth/AuthContext';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { getCategories } from '@/services/transactionService';
import {
  cancelInvitation,
  deleteContribution,
  deleteVaca,
  getVaca,
  inviteByEmail,
  regenerateCode,
  removeMember,
  sendReminders,
  updateMember,
  updateVaca,
} from '@/services/vacaService';

/** Cada cuánto se vuelve a pedir la vaca mientras la pantalla está a la vista (aportes de otros). */
const REFRESH_MS = 15_000;

/** `@/offline/vacaQueue` (con Dexie) se carga aparte para no engordar el bundle de la página. */
const loadQueue = () => import('@/offline/vacaQueue');

/**
 * Una cifra del resumen.
 * @param {{ label: string, value: string, hint?: string }} props
 */
function Stat({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl bg-ink/5 p-3">
      <dt className="text-xs text-ink/60">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-ink/60">{hint}</dd>}
    </div>
  );
}

/**
 * Botón con confirmación en línea (sin diálogos del navegador).
 * @param {{ label: string, question: string, confirmLabel: string, icon: import('lucide-react').LucideIcon, disabled?: boolean, onConfirm: () => Promise<void> }} props
 */
function ConfirmButton({ label, question, confirmLabel, icon: Icon, disabled, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!confirming) {
    return (
      <Button variant="ghost" className="justify-start text-negative" disabled={disabled} onClick={() => setConfirming(true)}>
        <Icon aria-hidden="true" /> {label}
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl bg-negative/5 p-3">
      <p className="text-sm">{question}</p>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await onConfirm();
            } catch (err) {
              setError(err.message);
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Página privada `/app/vacas/:id` (FT-0015): seguimiento de aportes de una vaca. Muestra el avance
 * del grupo, lo que lleva y le falta a cada miembro, el ritmo y el consejo; permite aportar (también
 * sin conexión), invitar y, a los administradores, ajustar cuotas, roles y datos de la vaca.
 * Se actualiza sola cada 15 s, al volver a la pestaña y al recuperar la conexión, para ver los
 * aportes de los demás.
 */
export default function VacaDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { user } = useAuth();
  const [vaca, setVaca] = useState(null);
  const [error, setError] = useState('');
  const [gone, setGone] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [pending, setPending] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notice, setNotice] = useState(
    state?.created ? 'Vaca creada. Invita a los demás con el enlace o el código.' : state?.joined ? '¡Ya eres parte de la vaca!' : '',
  );
  const [editing, setEditing] = useState(false);
  const loading = useRef(false);
  usePageTitle(vaca?.name ?? 'Vaca');

  const refreshPending = useCallback(async () => {
    const queue = await loadQueue();
    setPending(await queue.listPendingContributions(id).catch(() => []));
  }, [id]);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const queue = await loadQueue();
    try {
      const data = await getVaca(id);
      setVaca(data);
      setFromCache(false);
      setError('');
      queue.cacheVaca(data).catch(() => {});
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        setGone(true);
        queue.uncacheVaca(id).catch(() => {});
      } else {
        const cached = await queue.getCachedVaca(id).catch(() => null);
        if (cached) {
          setVaca((current) => current ?? cached);
          setFromCache(true);
        } else {
          setError(err.message);
        }
      }
    } finally {
      loading.current = false;
    }
  }, [id]);

  // Carga inicial, aportes pendientes y los que se hayan quedado de antes.
  useEffect(() => {
    setVaca(null);
    setGone(false);
    load();
    refreshPending();
    loadQueue().then((queue) => queue.flushContributions());
  }, [load, refreshPending]);

  useEffect(() => {
    getCategories()
      .then((all) => setCategories(all.expense))
      .catch(() => {});
  }, []);

  // Aportes de los demás: se pide de nuevo cada 15 s con la pantalla a la vista y al volver a ella.
  useEffect(() => {
    if (!online) return undefined;
    const tick = () => document.visibilityState === 'visible' && load();
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [online, load]);

  // Al volver la conexión se envían los pendientes; cada envío se anuncia y refresca la pantalla.
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    loadQueue().then(({ VACA_SYNC_EVENT, flushContributions }) => {
      if (cancelled) return;
      const onSync = ({ detail }) => {
        if (detail.vacaId && detail.vacaId !== id) return;
        refreshPending();
        if (detail.synced) load();
        if (detail.fromQueue) setNotice('Se envió tu aporte que estaba pendiente.');
        if (detail.rejected) setNotice('');
      };
      const onOnline = () => flushContributions().then(load);
      window.addEventListener(VACA_SYNC_EVENT, onSync);
      window.addEventListener('online', onOnline);
      cleanup = () => {
        window.removeEventListener(VACA_SYNC_EVENT, onSync);
        window.removeEventListener('online', onOnline);
      };
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [id, load, refreshPending]);

  /** Ejecuta una acción que devuelve la vaca actualizada y la pinta. */
  const apply = async (action, message) => {
    const updated = await action();
    if (updated) setVaca(updated);
    setNotice(message ?? '');
    if (updated) loadQueue().then((queue) => queue.cacheVaca(updated));
  };

  const handleContribute = async (values) => {
    const queue = await loadQueue();
    const result = await queue.saveContribution(id, values);
    if (result.queued) {
      setNotice('Sin conexión: tu aporte quedó guardado en el dispositivo y se envía solo al volver internet.');
      refreshPending();
    } else {
      setVaca(result.result.vaca);
      setNotice(`Aporte de ${formatMoney(values.amount)} registrado. También quedó en tus movimientos.`);
    }
  };

  const handleDeleteContribution = async (contributionId) => {
    const { transactionId } = await deleteContribution(id, contributionId);
    if (transactionId) import('@/offline/sync').then((m) => m.uncacheTransaction(transactionId)).catch(() => {});
    setNotice('Aporte borrado, junto con su gasto.');
    await load();
  };

  const handleDiscard = async (localId) => {
    const queue = await loadQueue();
    await queue.discardPendingContribution(localId);
    refreshPending();
  };

  const leave = async () => {
    await removeMember(id, user.id);
    (await loadQueue()).uncacheVaca(id).catch(() => {});
    navigate('/app/vacas', { replace: true });
  };

  const remove = async () => {
    await deleteVaca(id);
    (await loadQueue()).uncacheVaca(id).catch(() => {});
    navigate('/app/vacas', { replace: true });
  };

  if (gone) {
    return (
      <Panel className="mx-auto max-w-lg text-center">
        <p className="text-lg font-semibold">Esta vaca ya no está disponible</p>
        <p className="mt-1 text-ink/60">Se eliminó o ya no eres miembro.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/app/vacas">Ir a mis vacas</Link>
        </Button>
      </Panel>
    );
  }

  if (!vaca) {
    return error ? (
      <p role="alert" className="text-negative">
        {error}{' '}
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

  const status = VACA_STATUS[vaca.status];
  const mine = MEMBER_STATUS[vaca.myStatus];
  const isAdmin = vaca.role === 'admin';
  const pendingTotal = pending.filter((p) => !p.rejected).reduce((acc, p) => acc + p.contribution.amount, 0);

  return (
    <>
      <Link
        to="/app/vacas"
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Mis vacas
      </Link>
      <PageHeader
        title={vaca.name}
        description={vaca.description ?? undefined}
        actions={
          <span className={cn('rounded-full px-3 py-1 text-sm font-medium', status.chip)}>{status.label}</span>
        }
      />

      <p role="status" className="-mt-3 mb-3 min-h-5 text-sm text-positive">
        {notice}
      </p>
      {fromCache && (
        <p className="mb-3 text-sm text-ink/60">
          Sin conexión: ves la última versión guardada. Los aportes que hagas se envían al volver internet.
        </p>
      )}

      <Panel aria-label="Avance de la vaca" className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="tabular-nums text-ink/60">
            <span className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{formatMoney(vaca.total)}</span>{' '}
            de {formatMoney(vaca.goal)}
          </p>
          <p className="text-lg font-semibold tabular-nums">{formatPercent(vaca.percentage)}</p>
        </div>
        <div className="mt-3">
          <VacaProgress
            size="lg"
            value={vaca.percentage}
            barClass={status.bar}
            label={`Avance de ${vaca.name}`}
            valueText={`${formatPercent(vaca.percentage)}: ${formatMoney(vaca.total)} de ${formatMoney(vaca.goal)}`}
          />
        </div>
        {pendingTotal > 0 && (
          <p className="mt-2 text-sm text-caution">
            + {formatMoney(pendingTotal)} tuyos pendientes de enviar
          </p>
        )}
        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Tu parte"
            value={`${formatMoney(vaca.myContributed)} de ${formatMoney(vaca.myQuota)}`}
            hint={vaca.myRemaining > 0 ? `Te faltan ${formatMoney(vaca.myRemaining)} · ${mine.label}` : mine.label}
          />
          <Stat label="Le falta al grupo" value={formatMoney(vaca.projection.remaining)} />
          <Stat
            label="Ritmo"
            value={`${formatMoney(vaca.projection.averagePerDay)} / día`}
            hint={vaca.projection.estimatedDate ? `Terminan hacia el ${formatDate(vaca.projection.estimatedDate)}` : undefined}
          />
          <Stat
            label="Plazo"
            value={deadlineText(vaca)}
            hint={
              vaca.projection.neededPerWeek !== null ? `Hacen falta ${formatMoney(vaca.projection.neededPerWeek)} / semana` : undefined
            }
          />
        </dl>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel aria-labelledby="contribute-title">
            <h2 id="contribute-title" className="mb-4 text-lg font-semibold tracking-tight">
              Aportar
            </h2>
            <ContributionForm categories={categories} myRemaining={vaca.myRemaining} onSubmit={handleContribute} />
          </Panel>

          <Panel aria-labelledby="members-title">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="members-title" className="text-lg font-semibold tracking-tight">
                Miembros ({vaca.membersCount})
              </h2>
              <p className="text-sm text-ink/60">
                {vaca.split === 'igual' ? 'Partes iguales' : 'Cuotas a medida'}
              </p>
            </div>
            <MemberList
              members={vaca.members}
              isAdmin={isAdmin}
              split={vaca.split}
              online={online}
              onUpdate={(userId, changes) => apply(() => updateMember(id, userId, changes), 'Miembro actualizado.')}
              onRemove={async (userId) => {
                await removeMember(id, userId);
                setNotice('Miembro retirado de la vaca. Sus aportes siguen contando.');
                await load();
              }}
            />
          </Panel>

          <Panel aria-labelledby="contributions-title">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="contributions-title" className="text-lg font-semibold tracking-tight">
                Aportes
              </h2>
              {online && <p className="text-xs text-ink/50">Se actualiza solo</p>}
            </div>
            <ContributionList
              contributions={vaca.contributions}
              pending={pending}
              online={online}
              onDelete={handleDeleteContribution}
              onDiscard={handleDiscard}
            />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel aria-labelledby="smart-title">
            <h2 id="smart-title" className="mb-4 text-lg font-semibold tracking-tight">
              ¿Van a tiempo?
            </h2>
            <AdviceCard vaca={vaca} online={online && !fromCache} onRemind={() => sendReminders(id)} />
          </Panel>

          <Panel aria-labelledby="invite-title">
            <h2 id="invite-title" className="mb-4 text-lg font-semibold tracking-tight">
              Invitar
            </h2>
            <InvitePanel
              vaca={vaca}
              online={online}
              onInvite={async (email) => {
                const result = await inviteByEmail(id, email);
                if (isAdmin) load();
                return result;
              }}
              onCancelInvitation={async (email) => {
                await cancelInvitation(id, email);
                await load();
              }}
              onRegenerate={async () => {
                const { code } = await regenerateCode(id);
                setVaca((current) => ({ ...current, code }));
                setNotice('Código cambiado: comparte el enlace nuevo.');
              }}
            />
          </Panel>

          <Panel aria-labelledby="settings-title">
            <h2 id="settings-title" className="mb-3 text-lg font-semibold tracking-tight">
              Ajustes
            </h2>
            {editing ? (
              <VacaForm
                initial={vaca}
                disabled={!online}
                onSubmit={(values) =>
                  apply(() => updateVaca(id, values), 'Cambios guardados.').then(() => setEditing(false))
                }
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="flex flex-col gap-1">
                {isAdmin && (
                  <Button variant="ghost" className="justify-start" disabled={!online} onClick={() => setEditing(true)}>
                    <Pencil aria-hidden="true" /> Editar la vaca
                  </Button>
                )}
                <ConfirmButton
                  label="Salirme de la vaca"
                  question="Tus aportes seguirán contando para el grupo y sus gastos quedan en tus movimientos."
                  confirmLabel="Sí, salirme"
                  icon={LogOut}
                  disabled={!online}
                  onConfirm={leave}
                />
                {isAdmin && (
                  <ConfirmButton
                    label="Eliminar la vaca"
                    question="Se borra para todos los miembros. Los gastos de los aportes quedan en los movimientos de cada uno."
                    confirmLabel="Sí, eliminar"
                    icon={Trash2}
                    disabled={!online}
                    onConfirm={remove}
                  />
                )}
                {!online && <p className="mt-1 text-sm text-ink/60">Necesitas conexión para cambiar la vaca.</p>}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
