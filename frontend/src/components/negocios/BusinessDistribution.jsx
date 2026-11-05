import { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';
import Panel from '@/components/layout/Panel';
import { formatShare } from '@/components/negocios/negocioFormat';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Hoja "Registrar mi retiro": la plata sale del negocio y entra como ingreso en tus movimientos.
 * @param {{ suggested: number, businessName: string, today: string, disabled: boolean, onSubmit: (data: object) => Promise<void> }} props
 */
export function WithdrawalForm({ suggested, businessName, today, disabled, onSubmit }) {
  const [amount, setAmount] = useState(suggested > 0 ? String(suggested) : '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!amount || !(value > 0)) {
      setError('Ingresa un monto mayor que 0');
      return;
    }
    if (!date || date > today) {
      setError('La fecha no puede ser futura');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ amount: value, note: note.trim() || null, date, localId: crypto.randomUUID() });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form className="space-y-4" onSubmit={submit} noValidate aria-label="Registrar mi retiro">
      <p className="text-sm text-ink/60">
        Sale del negocio y entra como ingreso «Retiro de {businessName}» en tus movimientos. No baja la utilidad del negocio.
      </p>
      <FormField id="wd-amount" label="Monto (COP)">
        <MoneyInput value={amount} onChange={setAmount} placeholder="0" disabled={disabled || busy} />
      </FormField>
      <FormField id="wd-note" label="Nota (opcional)">
        <Input
          autoComplete="off"
          maxLength={120}
          placeholder="Ej.: mi parte de octubre"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={disabled || busy}
        />
      </FormField>
      <FormField id="wd-date" label="Fecha">
        <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled || busy} />
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        Registrar mi retiro
      </Button>
    </form>
  );
}

/**
 * Reparto de la utilidad del mes según la participación de cada socio (FT-0018). Cada socio
 * registra su propio retiro, porque entra a sus finanzas personales.
 * @param {{ distribution: object, myId: string, canWithdraw: boolean, online: boolean, onWithdraw: (suggested: number) => void }} props
 */
export default function BusinessDistribution({ distribution, myId, canWithdraw, online, onWithdraw }) {
  const mine = distribution.items.find((i) => i.userId === myId);
  return (
    <Panel aria-labelledby="reparto-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="reparto-title" className="font-semibold">
            Reparto de utilidades
          </h3>
          <p className="text-sm text-ink/60">
            {distribution.available > 0
              ? `Hay ${formatMoney(distribution.available)} de utilidad para repartir según la participación.`
              : 'Este mes no hay utilidad para repartir.'}
          </p>
        </div>
        {canWithdraw && (
          <Button variant="soft" onClick={() => onWithdraw(mine?.pending ?? 0)} disabled={!online}>
            <Wallet aria-hidden="true" /> Registrar mi retiro
          </Button>
        )}
      </div>

      {distribution.items.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">
          Para ver cuánto le toca a cada uno, un dueño debe asignar la participación de los socios (⋮ en cada socio).
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ink/10" aria-label="Reparto por socio">
          {distribution.items.map((item) => (
            <li key={item.userId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{item.userId === myId ? 'Tú' : item.name || 'Socio'}</span>
                <span className="text-ink/60"> · {formatShare(item.share)}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular-nums">{formatMoney(item.due)}</span>
                <span className={cn('block text-xs', item.pending > 0 ? 'text-ink/60' : 'text-positive')}>
                  {item.withdrawn > 0
                    ? item.pending > 0
                      ? `Retiró ${formatMoney(item.withdrawn)} · le faltan ${formatMoney(item.pending)}`
                      : `Ya retiró ${formatMoney(item.withdrawn)}`
                    : 'Aún no retira'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {distribution.items.length > 0 && distribution.unassignedShare > 0 && (
        <p className="mt-2 text-xs text-ink/60">
          {formatShare(distribution.unassignedShare)} de la participación no está asignada.
        </p>
      )}
    </Panel>
  );
}
