import { useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import MoneyInput from '@/components/common/MoneyInput';
import Panel from '@/components/layout/Panel';
import IncomeFields from '@/components/money/IncomeFields';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAsync from '@/hooks/useAsync';
import { readCommitmentForm, toProfileData } from '@/lib/moneyProfile';
import {
  createCommitment,
  deleteCommitment,
  getMoneyProfile,
  updateCommitment,
  updateMoneyProfile,
} from '@/services/moneyProfileService';

const EMPTY_COMMITMENT = { id: null, name: '', amount: '', dayOfMonth: '' };

/**
 * Cómo le entra la plata al usuario y cuánta tiene.
 * @param {{ profile: import('@/services/moneyProfileService').MoneyProfile, onSaved: () => void }} props
 */
function IncomeForm({ profile, onSaved }) {
  const [income, setIncome] = useState({ incomeType: '', payDays: [] });
  const [balance, setBalance] = useState('');
  const [status, setStatus] = useState({ error: '', saved: false, saving: false });

  useEffect(() => {
    setIncome({ incomeType: profile.incomeType ?? '', payDays: profile.payDays });
    setBalance(profile.balance === null ? '' : String(profile.balance));
  }, [profile]);

  const save = async (event) => {
    event.preventDefault();
    if (income.incomeType === 'fecha_fija' && income.payDays.length === 0) {
      setStatus({ error: 'Elige al menos un día de pago.', saved: false, saving: false });
      return;
    }
    setStatus({ error: '', saved: false, saving: true });
    try {
      await updateMoneyProfile(toProfileData({ ...income, balance }));
      setStatus({ error: '', saved: true, saving: false });
      onSaved();
    } catch (err) {
      setStatus({ error: err.message, saved: false, saving: false });
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <IncomeFields
        incomeType={income.incomeType}
        payDays={income.payDays}
        onChange={(changes) => setIncome((current) => ({ ...current, ...changes }))}
      />
      <div className="space-y-2">
        <Label htmlFor="money-balance">Cuánta plata tienes hoy, más o menos</Label>
        <MoneyInput id="money-balance" value={balance} onChange={setBalance} placeholder="0" />
      </div>
      {status.error && (
        <p role="alert" className="text-sm text-negative">
          {status.error}
        </p>
      )}
      {status.saved && (
        <p role="status" className="text-sm text-positive">
          Guardado.
        </p>
      )}
      <Button type="submit" disabled={status.saving}>
        {status.saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        Guardar
      </Button>
    </form>
  );
}

/**
 * Lista de pagos mensuales, con un solo formulario para agregar o editar.
 * @param {{ commitments: import('@/services/moneyProfileService').Commitment[], onChanged: () => void }} props
 */
function Commitments({ commitments, onChanged }) {
  const [form, setForm] = useState(EMPTY_COMMITMENT);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const change = (changes) => setForm((current) => ({ ...current, ...changes }));

  const save = async (event) => {
    event.preventDefault();
    const { data, error: problem } = readCommitmentForm(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (form.id) await updateCommitment(form.id, data);
      else await createCommitment(data);
      setForm(EMPTY_COMMITMENT);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (commitment) => {
    setError('');
    try {
      await deleteCommitment(commitment.id);
      if (form.id === commitment.id) setForm(EMPTY_COMMITMENT);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = ({ id, name, amount, dayOfMonth }) => {
    setError('');
    setForm({ id, name, amount: String(amount), dayOfMonth: String(dayOfMonth) });
  };

  return (
    <div>
      <h3 className="font-medium">Pagos de cada mes</h3>
      {commitments.length === 0 ? (
        <p className="mt-1 text-sm text-ink/60">Aún no tienes pagos guardados.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/10">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-sm text-ink/60">
                  {formatMoney(c.amount)} · día {c.dayOfMonth}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => edit(c)}>
                <Pencil aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Eliminar ${c.name}`} onClick={() => remove(c)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={save} className="mt-4 space-y-3 rounded-2xl bg-ink/5 p-4">
        <div className="space-y-2">
          <Label htmlFor="commitment-name">Nombre</Label>
          <Input
            id="commitment-name"
            maxLength={60}
            placeholder="Arriendo"
            value={form.name}
            onChange={(e) => change({ name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="commitment-amount">Monto</Label>
            <MoneyInput
              id="commitment-amount"
              value={form.amount}
              showHint={false}
              onChange={(amount) => change({ amount })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commitment-day">Día</Label>
            <Input
              id="commitment-day"
              inputMode="numeric"
              maxLength={2}
              placeholder="30"
              value={form.dayOfMonth}
              onChange={(e) => change({ dayOfMonth: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="soft" disabled={saving}>
            {form.id ? 'Guardar cambios' : 'Agregar pago'}
          </Button>
          {form.id && (
            <Button type="button" variant="ghost" onClick={() => setForm(EMPTY_COMMITMENT)}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Sección de Cuenta con lo que se respondió en la bienvenida (FT-0036). */
export default function MoneyProfileSettings() {
  const profile = useAsync(getMoneyProfile, []);

  return (
    <Panel aria-labelledby="mi-plata">
      <h2 id="mi-plata" className="text-lg font-semibold tracking-tight">
        Mi plata
      </h2>
      <p className="mt-1 text-sm text-ink/60">Cómo te entra la plata y qué pagas cada mes.</p>
      <div className="mt-5 space-y-6">
        {profile.error && !profile.data && (
          <p role="alert" className="text-sm text-negative">
            {profile.error}{' '}
            <button type="button" className="underline" onClick={profile.reload}>
              Reintentar
            </button>
          </p>
        )}
        {profile.data && (
          <>
            <IncomeForm profile={profile.data} onSaved={profile.reload} />
            <Commitments commitments={profile.data.commitments} onChanged={profile.reload} />
          </>
        )}
      </div>
    </Panel>
  );
}
