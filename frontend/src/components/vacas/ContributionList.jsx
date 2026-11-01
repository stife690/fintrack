import { useState } from 'react';
import { CloudOff, Trash2, TriangleAlert } from 'lucide-react';
import { formatRelativeDay } from '@/components/transactions/format';
import { formatPesos } from './vacaFormat';
import { Button } from '@/components/ui/button';

/**
 * Aporte que todavía está en el dispositivo (sin conexión) o que el servidor rechazó.
 * @param {object} props
 * @param {{ localId: string, contribution: { amount: number, date: string, note: string|null }, rejected?: string }} props.pending
 * @param {(localId: string) => Promise<void>} props.onDiscard
 */
function PendingRow({ pending, onDiscard }) {
  const { amount, date, note } = pending.contribution;
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-caution/15 text-caution"
      >
        {pending.rejected ? <TriangleAlert className="size-4" /> : <CloudOff className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium">Tú</p>
          <p className="shrink-0 font-semibold tabular-nums">{formatPesos(amount)}</p>
        </div>
        <p className="truncate text-sm text-ink/60">
          {formatRelativeDay(date)}
          {note && ` · ${note}`}
        </p>
        <p className="text-sm text-caution">
          {pending.rejected ? `No se pudo registrar: ${pending.rejected}` : 'Pendiente: se envía al volver la conexión'}
        </p>
        {pending.rejected && (
          <Button size="sm" variant="ghost" className="-ml-3" onClick={() => onDiscard(pending.localId)}>
            Descartar
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Aporte confirmado. Solo quien lo hizo puede borrarlo (también se borra su gasto).
 * @param {object} props
 * @param {import('@/services/vacaService').VacaContribution} props.contribution
 * @param {boolean} props.online
 * @param {(id: string) => Promise<void>} props.onDelete
 */
function ContributionRow({ contribution, online, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await onDelete(contribution.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand"
      >
        {contribution.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium">{contribution.isMe ? 'Tú' : contribution.name}</p>
          <p className="shrink-0 font-semibold tabular-nums text-positive">+{formatPesos(contribution.amount)}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-ink/60">
            {formatRelativeDay(contribution.date)}
            {contribution.note && ` · ${contribution.note}`}
          </p>
          {contribution.isMe && !confirming && (
            <Button
              size="icon"
              variant="ghost"
              className="-my-1 -mr-1.5 size-7 shrink-0 text-ink/50 [&_svg]:size-4"
              disabled={!online}
              onClick={() => setConfirming(true)}
              aria-label={`Borrar aporte de ${formatPesos(contribution.amount)}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        {confirming && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-sm text-ink/60">¿Borrar el aporte y su gasto?</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={remove}>
              Sí, borrar
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              No
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Historial de aportes del grupo (FT-0015): primero los pendientes del dispositivo y después
 * los confirmados, del más reciente al más antiguo.
 * @param {object} props
 * @param {import('@/services/vacaService').VacaContribution[]} props.contributions
 * @param {Array<object>} props.pending Aportes en la cola del dispositivo.
 * @param {boolean} props.online
 * @param {(id: string) => Promise<void>} props.onDelete
 * @param {(localId: string) => Promise<void>} props.onDiscard
 */
export default function ContributionList({ contributions, pending, online, onDelete, onDiscard }) {
  if (contributions.length === 0 && pending.length === 0) {
    return <p className="py-6 text-center text-ink/60">Todavía no hay aportes. ¡Sé el primero en poner tu parte!</p>;
  }
  return (
    <ul className="divide-y divide-ink/10">
      {pending.map((p) => (
        <PendingRow key={p.localId} pending={p} onDiscard={onDiscard} />
      ))}
      {contributions.map((c) => (
        <ContributionRow key={c.id} contribution={c} online={online} onDelete={onDelete} />
      ))}
    </ul>
  );
}
