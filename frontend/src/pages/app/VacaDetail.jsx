import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, HandCoins, Loader2, LogOut, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import Tabs from '@/components/common/Tabs';
import Panel from '@/components/layout/Panel';
import { formatDate } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import AdviceCard from '@/components/vacas/AdviceCard';
import ContributionForm from '@/components/vacas/ContributionForm';
import ContributionList from '@/components/vacas/ContributionList';
import InvitePanel from '@/components/vacas/InvitePanel';
import MemberList from '@/components/vacas/MemberList';
import VacaForm from '@/components/vacas/VacaForm';
import VacaProgress from '@/components/vacas/VacaProgress';
import { MEMBER_STATUS, VACA_STATUS, deadlineText, formatPercent, formatPesos } from '@/components/vacas/vacaFormat';
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
      <dd className="mt-0.5 break-words font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 break-words text-xs text-ink/60">{hint}</dd>}
    </div>
  );
}

/**
 * Página privada `/app/vacas/:id` (FT-0015): seguimiento de aportes de una vaca. Arriba, el avance
 * del grupo con las dos acciones principales (aportar e invitar); debajo, miembros y aportes en
 * pestañas y si van a tiempo. Aportar, invitar y los ajustes se abren en una ventana.
 * Aportar funciona sin conexión. Se actualiza sola cada 15 s, al volver a la pestaña y al recuperar
 * la conexión, para ver los aportes de los demás.
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
  const [sheet, setSheet] = useState(state?.created ? 'invitar' : null); // 'aportar' | 'invitar' | 'opciones' | 'editar'
  const [tab, setTab] = useState('miembros');
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
    setSheet(null);
    setTab('aportes');
    if (result.queued) {
      setNotice('Sin conexión: tu aporte quedó guardado en el dispositivo y se envía solo al volver internet.');
      refreshPending();
    } else {
      setVaca(result.result.vaca);
      setNotice(`Aporte de ${formatPesos(values.amount)} registrado. También quedó en tus movimientos.`);
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
  const closeSheet = () => setSheet(null);

  return (
    <>
      <Link
        to="/app/vacas"
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Mis vacas
      </Link>

      <header className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">{vaca.name}</h1>
          {vaca.description && <p className="mt-1 break-words text-ink/60">{vaca.description}</p>}
          <span className={cn('mt-2 inline-block rounded-full px-2.5 py-0.5 text-sm font-medium', status.chip)}>
            {status.label}
          </span>
        </div>
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => setSheet('opciones')} aria-label="Opciones de la vaca">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </header>

      <p role="status" className={cn('text-sm text-positive', notice && 'mb-4')}>
        {notice}
      </p>
      {fromCache && (
        <p className="mb-4 text-sm text-ink/60">
          Sin conexión: ves la última versión guardada. Los aportes que hagas se envían al volver internet.
        </p>
      )}

      <Panel aria-label="Avance de la vaca" className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 tabular-nums text-ink/60">
            <span className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{formatPesos(vaca.total)}</span>
            <span>de {formatPesos(vaca.goal)}</span>
          </p>
          <p className="text-lg font-semibold tabular-nums">{formatPercent(vaca.percentage)}</p>
        </div>
        <div className="mt-3">
          <VacaProgress
            size="lg"
            value={vaca.percentage}
            barClass={status.bar}
            label={`Avance de ${vaca.name}`}
            valueText={`${formatPercent(vaca.percentage)}: ${formatPesos(vaca.total)} de ${formatPesos(vaca.goal)}`}
          />
        </div>
        {pendingTotal > 0 && (
          <p className="mt-2 text-sm text-caution">+ {formatPesos(pendingTotal)} tuyos pendientes de enviar</p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat
            label="Tu parte"
            value={formatPesos(vaca.myContributed)}
            hint={`de ${formatPesos(vaca.myQuota)} · ${mine.label}`}
          />
          <Stat label="Le falta al grupo" value={formatPesos(vaca.projection.remaining)} />
          <Stat
            label="Ritmo por día"
            value={formatPesos(vaca.projection.averagePerDay)}
            hint={vaca.projection.estimatedDate ? `Terminan hacia el ${formatDate(vaca.projection.estimatedDate)}` : undefined}
          />
          <Stat
            label="Plazo"
            value={deadlineText(vaca, { withDate: false })}
            hint={
              vaca.projection.neededPerWeek !== null
                ? `Hacen falta ${formatPesos(vaca.projection.neededPerWeek)} por semana`
                : vaca.deadline
                  ? formatDate(vaca.deadline)
                  : undefined
            }
          />
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
          <Button size="lg" className="sm:min-w-40" onClick={() => setSheet('aportar')}>
            <HandCoins aria-hidden="true" /> Aportar
          </Button>
          <Button size="lg" variant="outline" className="sm:min-w-40" onClick={() => setSheet('invitar')}>
            <UserPlus aria-hidden="true" /> Invitar
          </Button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel aria-label="Miembros y aportes">
          <Tabs
            label="Miembros y aportes"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'miembros', label: 'Miembros', count: vaca.membersCount },
              { value: 'aportes', label: 'Aportes', count: vaca.contributions.length + pending.length },
            ]}
          >
            {(current) =>
              current === 'miembros' ? (
                <>
                  <p className="pt-2 text-sm text-ink/60">
                    {vaca.split === 'igual' ? 'La meta se reparte en partes iguales.' : 'Cada miembro tiene una cuota a medida.'}
                  </p>
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
                </>
              ) : (
                <ContributionList
                  contributions={vaca.contributions}
                  pending={pending}
                  online={online}
                  onDelete={handleDeleteContribution}
                  onDiscard={handleDiscard}
                />
              )
            }
          </Tabs>
        </Panel>

        <Panel aria-labelledby="smart-title" className="self-start">
          <h2 id="smart-title" className="mb-4 text-lg font-semibold tracking-tight">
            ¿Van a tiempo?
          </h2>
          <AdviceCard vaca={vaca} online={online && !fromCache} onRemind={() => sendReminders(id)} />
        </Panel>
      </div>

      <Sheet
        open={sheet === 'aportar'}
        title="Aportar"
        description={vaca.myRemaining > 0 ? `Te faltan ${formatPesos(vaca.myRemaining)} de tu parte.` : 'Ya pusiste tu parte.'}
        onClose={closeSheet}
      >
        <ContributionForm categories={categories} myRemaining={vaca.myRemaining} onSubmit={handleContribute} />
      </Sheet>

      <Sheet open={sheet === 'invitar'} title="Invitar a la vaca" onClose={closeSheet}>
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
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'editar'} title="Editar la vaca" onClose={closeSheet}>
        <VacaForm
          initial={vaca}
          disabled={!online}
          onSubmit={(values) => apply(() => updateVaca(id, values), 'Cambios guardados.').then(closeSheet)}
          onCancel={closeSheet}
        />
      </Sheet>

      <Sheet open={sheet === 'opciones'} title="Opciones de la vaca" onClose={closeSheet}>
        <div className="flex flex-col gap-1">
          {isAdmin && (
            <Button variant="ghost" className="justify-start" disabled={!online} onClick={() => setSheet('editar')}>
              <Pencil aria-hidden="true" /> Editar nombre, meta y reparto
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
      </Sheet>
    </>
  );
}
