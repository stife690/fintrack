import { useState } from 'react';
import { Percent, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_OPTIONS, formatShare } from './negocioFormat';

/**
 * Editor en línea de la participación de un socio.
 * @param {object} props
 * @param {import('@/services/negocioService').Partner} props.partner
 * @param {(share: number|null) => Promise<void>} props.onSave `null` la quita.
 * @param {() => void} props.onClose
 */
function ShareEditor({ partner, onSave, onClose }) {
  const [value, setValue] = useState(partner.share === null ? '' : String(partner.share));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const number = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(number) && number >= 0 && number <= 100;

  const save = async (share) => {
    setBusy(true);
    setError('');
    try {
      await onSave(share);
      onClose();
    } catch (err) {
      setError(err.fields?.share ?? err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-ink/5 p-3">
      <label htmlFor={`share-${partner.userId}`} className="text-sm font-medium">
        Participación de {partner.isMe ? 'ti' : partner.name} (%)
      </label>
      <Input
        id={`share-${partner.userId}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ej. 50"
      />
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !valid} onClick={() => save(Math.round(number * 100) / 100)}>
          Guardar
        </Button>
        {partner.share !== null && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save(null)}>
            Quitar
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
 * Fila de un socio: nombre, rol, participación y, para los dueños, cambiar el rol, la
 * participación o sacarlo.
 * @param {object} props
 * @param {import('@/services/negocioService').Partner} props.partner
 * @param {boolean} props.isOwner Si quien mira es dueño.
 * @param {boolean} props.online
 * @param {(changes: object) => Promise<void>} props.onUpdate
 * @param {() => Promise<void>} props.onRemove
 */
function PartnerRow({ partner, isOwner, online, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const role = ROLES[partner.role];

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

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand"
        >
          {partner.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-medium">
              {partner.name}
              {partner.isMe && <span className="text-ink/60"> (tú)</span>}
            </p>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', role.chip)}>{role.label}</span>
            {partner.share !== null && (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium tabular-nums text-ink/70">
                {formatShare(partner.share)}
              </span>
            )}
          </div>
          {partner.email && <p className="mt-0.5 truncate text-sm text-ink/60">{partner.email}</p>}

          {isOwner && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select
                aria-label={`Rol de ${partner.name}`}
                className="h-9 w-auto rounded-lg px-3 text-sm"
                value={partner.role}
                disabled={!online || busy}
                onChange={(e) => run(() => onUpdate({ role: e.target.value }))}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {!editing && (
                <Button size="sm" variant="ghost" disabled={!online || busy} onClick={() => setEditing(true)}>
                  <Percent aria-hidden="true" /> Participación
                </Button>
              )}
              {!partner.isMe &&
                (confirming ? (
                  <>
                    <span className="ml-1 text-sm text-ink/60">¿Sacar del negocio?</span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => run(onRemove)}>
                      Sí, sacar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                      No
                    </Button>
                  </>
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
            <ShareEditor partner={partner} onSave={(share) => onUpdate({ share })} onClose={() => setEditing(false)} />
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Socios del negocio con su rol y su participación (FT-0016).
 * @param {object} props
 * @param {import('@/services/negocioService').Partner[]} props.partners
 * @param {boolean} props.isOwner
 * @param {boolean} props.online
 * @param {(userId: string, changes: object) => Promise<void>} props.onUpdate
 * @param {(userId: string) => Promise<void>} props.onRemove
 */
export default function PartnerList({ partners, isOwner, online, onUpdate, onRemove }) {
  return (
    <ul className="divide-y divide-ink/10">
      {partners.map((partner) => (
        <PartnerRow
          key={partner.userId}
          partner={partner}
          isOwner={isOwner}
          online={online}
          onUpdate={(changes) => onUpdate(partner.userId, changes)}
          onRemove={() => onRemove(partner.userId)}
        />
      ))}
    </ul>
  );
}
