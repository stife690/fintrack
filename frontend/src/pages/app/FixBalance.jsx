import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, Loader2 } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { toProfileData } from '@/lib/moneyProfile';
import { cn } from '@/lib/utils';
import { pressKey } from '@/pages/app/Anotar';
import { getMoneyPlan, getMoneyProfile, updateMoneyProfile } from '@/services/moneyProfileService';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];

/** Página privada `/app/mi-plata/corregir`: decir cuánta plata hay de verdad. */
export default function FixBalance() {
  usePageTitle('Corregir saldo');
  const navigate = useNavigate();
  const profile = useAsync(getMoneyProfile, []);
  const plan = useAsync(getMoneyPlan, []);
  const data = profile.data;
  const [amount, setAmount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const shown = amount ?? (typeof data?.money === 'number' ? String(Math.max(0, Math.round(data.money))) : '');
  const ledger = Math.round(plan.data?.ledger ?? 0);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) setAmount((a) => pressKey(a ?? '', event.key));
      else if (event.key === 'Backspace') setAmount((a) => pressKey(a ?? shown, 'borrar'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown]);

  const save = async (balance) => {
    setSaving(true);
    setError('');
    try {
      const form = { incomeType: data.incomeType ?? '', payDays: data.payDays, balance: String(balance) };
      await updateMoneyProfile({ ...toProfileData(form), resetBalance: true });
      navigate('/app/mi-plata', { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-md flex-col">
      <h1 className="text-[26px] font-semibold tracking-tight">¿Cuánta plata tienes?</h1>
      <p className="mt-1 text-[15px] text-ink/70">Suma banco, Nequi y efectivo</p>
      <p aria-live="polite" className={cn('mt-4 text-5xl font-semibold tracking-tight tabular-nums', !Number(shown) && 'text-ink/30')}>
        {formatMoney(Number(shown || 0))}
      </p>
      {ledger > 0 && ledger !== Math.round(data?.money ?? 0) && (
        <Button variant="soft" size="sm" className="mt-3 self-start rounded-full" disabled={saving} onClick={() => save(ledger)}>
          Usar lo que dicen mis movimientos
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}
        </p>
      )}

      <div role="group" aria-label="Teclado" className="mt-auto grid grid-cols-3 gap-1 pt-6">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setAmount((a) => pressKey(a ?? '', key))}
            className="h-[60px] touch-manipulation rounded-xl text-[26px] font-medium transition-colors active:bg-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          aria-label="Borrar"
          onClick={() => setAmount((a) => pressKey(a ?? shown, 'borrar'))}
          className="grid h-[60px] touch-manipulation place-items-center rounded-xl transition-colors active:bg-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
        >
          <Delete className="size-[26px]" aria-hidden="true" />
        </button>
      </div>
      <Button size="lg" className="mt-3" disabled={!data || saving || shown === ''} onClick={() => save(Number(shown))}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        Guardar saldo
      </Button>
    </div>
  );
}
