import { useState } from 'react';
import { Crown, MoreVertical, Pencil, UserMinus } from 'lucide-react';
import MoneyInput from '@/components/common/MoneyInput';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import VacaProgress from './VacaProgress';
import { MEMBER_STATUS, formatPercent, formatPesos } from './vacaFormat';

/**
 * Editor en línea de la cuota de un miembro (reparto personalizado).
 * @param {object} props
 * @param {import('@/services/vacaService').VacaMember} props.member
 * @param {(quota: number|null) => Promise<void>} props.onSave `null` vuelve a la cuota calculada.
 * @param {() => void} props.onClose
 */
function QuotaEditor({ member, onSave, onClose }) {
  const [value, setValue] = useState(member.customQuota === null ? '' : String(member.customQuota));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (quota) => {
    setBusy(true);
    setError('');
    try {
      await onSave(quota);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-ink/5 p-3">
      <label htmlFor={`quota-${member.userId}`} className="text-sm font-medium">
        Cuota de {member.isMe ? 'ti' : member.name}
      </label>
      <MoneyInput
        id={`quota-${member.userId}`}
        value={value}
        onChange={setValue}
        placeholder="0"
        showHint={false}
      />
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || value === ''} onClick={() => save(Number(value))}>
          Guardar cuota
        </Button>
        {member.customQuota !== null && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save(null)}>
            Usar la calculada
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Fila de un miembro: nombre, estado y cuánto lleva de su cuota. Las acciones de administrador
 * (cuota, rol, sacar) quedan detrás del botón de gestionar para no llenar la lista.
 * @param {object} props
 * @param {import('@/services/vacaService').VacaMember} props.member
 * @param {boolean} props.isAdmin Si quien mira es administrador.
 * @param {boolean} props.customSplit Reparto personalizado (se pueden poner cuotas).
 * @param {boolean} props.online
 * @param {(changes: object) => Promise<void>} props.onUpdate
 * @param {() => Promise<void>} props.onRemove
 */
function MemberRow({ member, isAdmin, customSplit, online, onUpdate, onRemove }) {
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = MEMBER_STATUS[member.status];

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const canManage = isAdmin && (customSplit || !member.isMe);

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand"
        >
          {member.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="flex min-w-0 flex-1 gap-1 font-medium">
              <span className="truncate">{member.name}</span>
              {member.isMe && <span className="shrink-0 text-ink/60">(tú)</span>}
            </p>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="-my-1.5 -mr-2 size-9 shrink-0"
                aria-expanded={managing}
                aria-label={`Gestionar a ${member.name}`}
                onClick={() => setManaging((v) => !v)}
              >
                <MoreVertical aria-hidden="true" />
              </Button>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {member.role === 'admin' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink/70">
                <Crown className="size-3" aria-hidden="true" /> Admin
              </span>
            )}
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.chip)}>{status.label}</span>
          </div>
          <p className="mt-2 text-sm tabular-nums text-ink/60">
            <span className="font-semibold text-ink">{formatPesos(member.contributed)}</span> de {formatPesos(member.quota)}
            {member.customQuota !== null && ' (a medida)'}
            {member.remaining > 0 && <span className="block">Le faltan {formatPesos(member.remaining)}</span>}
          </p>
          <div className="mt-2">
            <VacaProgress
              size="sm"
              value={member.percentage}
              barClass={status.bar}
              label={`Avance de ${member.name}`}
              valueText={`${formatPercent(member.percentage)} de su cuota`}
            />
          </div>

          {managing && (
            <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl bg-ink/5 p-1.5">
              {customSplit && !editing && (
                <Button size="sm" variant="ghost" disabled={!online || busy} onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" /> Cuota
                </Button>
              )}
              {!member.isMe && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!online || busy}
                  onClick={() => run(() => onUpdate({ role: member.role === 'admin' ? 'miembro' : 'admin' }))}
                >
                  <Crown aria-hidden="true" /> {member.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                </Button>
              )}
              {!member.isMe &&
                (confirming ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="px-2 text-sm text-ink/60">¿Sacar de la vaca?</span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => run(onRemove)}>
                      Sí, sacar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                      No
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" disabled={!online || busy} onClick={() => setConfirming(true)}>
                    <UserMinus aria-hidden="true" /> Sacar
                  </Button>
                ))}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-negative">
              {error}
            </p>
          )}
          {editing && (
            <QuotaEditor member={member} onSave={(quota) => onUpdate({ quota })} onClose={() => setEditing(false)} />
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Lista de miembros de la vaca con su cuota y su avance (FT-0015).
 * @param {object} props
 * @param {import('@/services/vacaService').VacaMember[]} props.members
 * @param {boolean} props.isAdmin
 * @param {'igual'|'personalizado'} props.split
 * @param {boolean} props.online
 * @param {(userId: string, changes: object) => Promise<void>} props.onUpdate
 * @param {(userId: string) => Promise<void>} props.onRemove
 */
export default function MemberList({ members, isAdmin, split, online, onUpdate, onRemove }) {
  return (
    <ul className="divide-y divide-ink/10">
      {members.map((member) => (
        <MemberRow
          key={member.userId}
          member={member}
          isAdmin={isAdmin}
          customSplit={split === 'personalizado'}
          online={online}
          onUpdate={(changes) => onUpdate(member.userId, changes)}
          onRemove={() => onRemove(member.userId)}
        />
      ))}
    </ul>
  );
}
