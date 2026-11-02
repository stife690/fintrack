import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, X } from 'lucide-react';
import MoneyInput from '@/components/common/MoneyInput';
import IncomeFields from '@/components/money/IncomeFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePageTitle from '@/hooks/usePageTitle';
import { SUGGESTED_COMMITMENTS, readCommitmentForm, toProfileData } from '@/lib/moneyProfile';
import { cn } from '@/lib/utils';
import { finishWelcome } from '@/services/moneyProfileService';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

const STEPS = 3;

/** Lo que el usuario escribe de un compromiso. `custom` deja cambiar el nombre. */
const newItem = (name, custom = false) => ({ key: crypto.randomUUID(), name, amount: '', dayOfMonth: '', custom });

/** Las tres preguntas. Va fuera de `AppShell`, sin menú, así que pone el tema por su cuenta. */
function WelcomeSteps() {
  usePageTitle('Bienvenida');
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [income, setIncome] = useState({ incomeType: '', payDays: [] });
  const [balance, setBalance] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (answers) => {
    setSaving(true);
    setError('');
    try {
      await finishWelcome(answers);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const profile = () => toProfileData({ ...income, balance });

  /** Con fecha fija hacen falta los días; omitir borra esa respuesta a medias. */
  const next = () => {
    if (step === 1 && income.incomeType === 'fecha_fija' && income.payDays.length === 0) {
      setError('Elige al menos un día, o toca Omitir.');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const skipStep = () => {
    setError('');
    if (step === 1) setIncome({ incomeType: '', payDays: [] });
    if (step === 2) setBalance('');
    setStep(step + 1);
  };

  const finish = () => {
    const read = items.map(readCommitmentForm);
    const problem = read.find((r) => r.error);
    if (problem) {
      setError(problem.error);
      return;
    }
    save({ ...profile(), commitments: read.map((r) => r.data) });
  };

  const toggleSuggestion = (name) => {
    setItems((current) =>
      current.some((i) => i.name === name) ? current.filter((i) => i.name !== name) : [...current, newItem(name)],
    );
  };

  const changeItem = (key, changes) => {
    setError('');
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  };

  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas text-ink antialiased">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink/60">
            Paso {step} de {STEPS}
          </p>
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => save({})}>
            Ahora no
          </Button>
        </div>

        <div className="mt-6 flex flex-1 flex-col gap-5">
          {step === 1 && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">¿Cómo te entra la plata?</h1>
              <IncomeFields
                incomeType={income.incomeType}
                payDays={income.payDays}
                onChange={(changes) => setIncome((current) => ({ ...current, ...changes }))}
              />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">¿Cuánta plata tienes hoy, más o menos?</h1>
              <div className="space-y-2">
                <Label htmlFor="welcome-balance">Total aproximado</Label>
                <MoneyInput id="welcome-balance" value={balance} onChange={setBalance} placeholder="0" autoFocus />
                <p className="text-sm text-ink/60">
                  Suma banco, Nequi y efectivo. No tiene que ser exacto y lo puedes corregir cuando quieras.
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">¿Qué pagas cada mes?</h1>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Pagos frecuentes">
                {SUGGESTED_COMMITMENTS.map((name) => {
                  const selected = items.some((i) => i.name === name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSuggestion(name)}
                      className={cn(
                        'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
                        selected ? 'border-brand bg-brand-soft text-brand' : 'border-ink/12 text-ink/70 hover:border-ink/25',
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setItems((current) => [...current, newItem('', true)])}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-ink/12 px-3.5 text-sm font-medium text-ink/70 hover:border-ink/25"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Otro
                </button>
              </div>

              {items.length > 0 && (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={item.key} className="rounded-2xl border border-ink/10 p-4">
                      <div className="flex items-center justify-between gap-2">
                        {item.custom ? (
                          <Input
                            aria-label="Nombre del pago"
                            placeholder="Nombre del pago"
                            maxLength={60}
                            value={item.name}
                            onChange={(e) => changeItem(item.key, { name: e.target.value })}
                          />
                        ) : (
                          <p className="font-medium">{item.name}</p>
                        )}
                        <button
                          type="button"
                          aria-label={`Quitar ${item.name || 'este pago'}`}
                          onClick={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                          className="grid size-10 shrink-0 place-items-center rounded-full text-ink/60 hover:text-ink"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor={`amount-${item.key}`}>Monto</Label>
                          <MoneyInput
                            id={`amount-${item.key}`}
                            value={item.amount}
                            showHint={false}
                            onChange={(amount) => changeItem(item.key, { amount })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`day-${item.key}`}>Día</Label>
                          <Input
                            id={`day-${item.key}`}
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="30"
                            value={item.dayOfMonth}
                            onChange={(e) => changeItem(item.key, { dayOfMonth: e.target.value.replace(/\D/g, '') })}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 mt-6 flex flex-col gap-2 bg-canvas py-3">
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          {step < STEPS ? (
            <>
              <Button onClick={next}>Seguir</Button>
              <Button variant="ghost" onClick={skipStep}>
                Omitir
              </Button>
            </>
          ) : (
            <>
              <Button onClick={finish} disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {saving ? 'Guardando…' : 'Terminar'}
              </Button>
              {items.length === 0 && (
                <Button variant="ghost" disabled={saving} onClick={() => save(profile())}>
                  Lo hago después
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Página privada `/app/bienvenida` (FT-0036): tres preguntas que se pueden omitir para que FinTrack
 * se ajuste a cómo le entra la plata a cada persona. Sale una vez; todo se cambia luego en Cuenta.
 */
export default function Welcome() {
  return (
    <ThemeProvider>
      <WelcomeSteps />
    </ThemeProvider>
  );
}
