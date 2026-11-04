import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Delete, Loader2, Mic, Sparkles } from 'lucide-react';
import ChipGroup from '@/components/common/ChipGroup';
import BudgetAlert from '@/components/transactions/BudgetAlert';
import DateQuickPick from '@/components/transactions/DateQuickPick';
import VoiceEntry from '@/components/transactions/VoiceEntry';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import usePageTitle from '@/hooks/usePageTitle';
import { NETWORK_LABELS } from '@/lib/cardStyles';
import { cn } from '@/lib/utils';
import { today, transactionSchema } from '@/lib/validation/transaction';
import { saveNewTransaction } from '@/offline/saveNewTransaction';
import { listCards } from '@/services/cardService';
import { getMoneyPlan } from '@/services/moneyProfileService';

const STEPS = ['1', '2', '3'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];
/** El monto máximo que acepta el servidor tiene 10 cifras enteras. */
const MAX_DIGITS = 10;
const AI = 'ia';
const CASH = 'cash';
/** Categorías que se ven sin tocar "Ver todas". */
const VISIBLE_CATEGORIES = 5;

const empty = () => ({ type: 'gasto', amount: '', description: '', category: AI, date: today(), card: CASH });

/**
 * Suma una tecla del teclado al monto (solo dígitos, sin ceros a la izquierda) o borra la última.
 * @param {string} amount Dígitos del monto, `''` si está vacío.
 * @param {string} key `'0'`–`'9'`, `'000'` o `'borrar'`.
 * @returns {string}
 */
export function pressKey(amount, key) {
  if (key === 'borrar') return amount.slice(0, -1);
  const next = (amount + key).replace(/^0+/, '');
  return next.length > MAX_DIGITS ? amount : next;
}

/**
 * Lo anotado, listo para guardar como lo haría el formulario de Movimientos (mismas reglas).
 * @returns {{ values?: object, error?: string }}
 */
export function toTransaction({ type, amount, description, category, date, card }) {
  const parsed = transactionSchema.safeParse({
    type,
    amount,
    description: description.trim(),
    date,
    category: category === AI ? '' : category,
    card: card === CASH ? null : card,
    installments: '1',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { values: { ...parsed.data, category: parsed.data.category || null } };
}

/** Barra de progreso de los tres pasos. */
function Progress({ step }) {
  const n = STEPS.indexOf(step) + 1;
  return (
    <div role="img" aria-label={`Paso ${n} de 3`} className="grid flex-1 grid-cols-3 gap-1">
      {STEPS.map((s, i) => (
        <span key={s} className={cn('h-1 rounded-full', i < n ? 'bg-brand' : 'bg-ink/10')} />
      ))}
    </div>
  );
}

/**
 * Página privada `/app/anotar`: registrar un gasto o un ingreso en tres pasos (cuánto, en qué,
 * revisar) y la confirmación. Cada paso va en la dirección (`?paso=2`), así "Volver" del celular
 * regresa un paso. Guarda con lo mismo que el formulario: sin conexión queda en la cola (FT-0009).
 */
export default function Anotar() {
  usePageTitle('Anotar');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = params.get('paso') ?? '1';
  const [form, setForm] = useState(empty);
  const [result, setResult] = useState(null); // lo que devolvió `saveNewTransaction`
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allCategories, setAllCategories] = useState(false);
  const [voice, setVoice] = useState(false);
  const shownDone = useRef(false); // ya se vio "listo": volver atrás empieza de nuevo
  const { categories, names } = useCategoryNames();
  const cards = useAsync(listCards, []);

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const go = (next) => setParams({ paso: next });

  // Al recargar en un paso sin datos, con "Anotar otro" o al volver atrás después de guardar, se
  // empieza de nuevo: así un mismo movimiento no se guarda dos veces.
  useEffect(() => {
    if (step === 'listo' && result) {
      shownDone.current = true;
      return;
    }
    const lost = step !== '1' && form.amount === '';
    if (lost || shownDone.current || step === 'listo') {
      shownDone.current = false;
      setForm(empty());
      setResult(null);
      setAllCategories(false);
      if (step !== '1') setParams({}, { replace: true });
    }
  }, [step, form.amount, result, setParams]);

  const save = async () => {
    const { values, error: invalid } = toTransaction(form);
    if (invalid) return setError(invalid);
    setError('');
    setSaving(true);
    try {
      const saved = await saveNewTransaction(values);
      const plan = saved.offline ? null : await getMoneyPlan().catch(() => null);
      setResult({ ...saved, values, money: plan?.ready ? plan.money : null });
      setParams({ paso: 'listo' }, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const expense = form.type === 'gasto';
  const amount = Number(form.amount || 0);
  const list = (expense ? categories?.expense : categories?.income) ?? [];
  const shown = allCategories ? list : list.slice(0, VISIBLE_CATEGORIES);
  const categoryName = form.category === AI ? 'la sugiere la IA' : names[form.category] ?? form.category;

  if (step === 'listo' && result) {
    const { values, transaction, alert, offline, money } = result;
    const category = transaction?.category;
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-between gap-8 rounded-3xl bg-violet p-6 text-white">
        <div className="my-auto">
          <span className="grid size-16 place-items-center rounded-full bg-white text-brand">
            <Check className="size-8" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <h1 role="status" className="mt-6 text-[32px] font-semibold tracking-tight">
            {values.type === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado'}
          </h1>
          <p className="mt-2 text-lg">
            {values.description} · {formatMoney(values.amount)}
          </p>
          <div className="mt-8 divide-y divide-white/30 rounded-2xl bg-white/15 px-4">
            {offline ? (
              <p className="py-4 text-[15px]">Guardado sin conexión. Se sincronizará cuando vuelva internet.</p>
            ) : (
              <>
                {category && (
                  <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                    <span>{transaction.source === 'ia' ? 'Categoría (sugerida por IA)' : 'Categoría'}</span>
                    <strong className="font-semibold">{names[category] ?? category}</strong>
                  </p>
                )}
                {money !== null && (
                  <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                    <span>Tu saldo ahora</span>
                    <strong className="text-[17px] font-semibold tabular-nums">{formatMoney(money)}</strong>
                  </p>
                )}
              </>
            )}
          </div>
          <BudgetAlert className="mt-4" alert={alert} categoryName={names[category]} />
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild size="lg" variant="outline-light" className="bg-white text-brand hover:bg-white/90 hover:text-brand">
            <Link to="/app" replace>
              Volver al inicio
            </Link>
          </Button>
          <Button size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setResult(null)}>
            Anotar otro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col">
      <h1 className="sr-only">Anotar</h1>
      <div className="flex items-center gap-3">
        <Progress step={step} />
      </div>

      {step === '1' && (
        <>
          <ChipGroup
            legend="Tipo de movimiento"
            hideLegend
            className="mt-4"
            options={[
              { value: 'gasto', label: 'Gasto' },
              { value: 'ingreso', label: 'Ingreso' },
            ]}
            value={form.type}
            onChange={(type) => set({ type, category: AI, card: CASH })}
          />
          <h2 className="mt-7 text-[26px] font-semibold tracking-tight">{expense ? '¿Cuánto gastaste?' : '¿Cuánto te entró?'}</h2>
          <p aria-live="polite" className={cn('mt-3 text-5xl font-semibold tracking-tight tabular-nums', !amount && 'text-ink/30')}>
            {formatMoney(amount)}
          </p>
          <Button variant="soft" size="sm" className="mt-3 self-start rounded-full" onClick={() => setVoice(true)}>
            <Mic aria-hidden="true" />
            Mejor lo dicto
          </Button>

          <div role="group" aria-label="Teclado" className="mt-auto grid grid-cols-3 gap-1 pt-6">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => set({ amount: pressKey(form.amount, key) })}
                className="h-[60px] rounded-2xl text-[26px] font-medium transition-colors hover:bg-ink/5 active:bg-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              aria-label="Borrar"
              onClick={() => set({ amount: pressKey(form.amount, 'borrar') })}
              className="grid h-[60px] place-items-center rounded-2xl transition-colors hover:bg-ink/5 active:bg-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
            >
              <Delete className="size-[26px]" aria-hidden="true" />
            </button>
          </div>
          <Button size="lg" className="mt-3" disabled={!amount} onClick={() => go('2')}>
            Continuar
          </Button>
        </>
      )}

      {step === '2' && (
        <>
          <p className="mt-5 text-[15px] text-ink/60">
            {expense ? 'Gasto' : 'Ingreso'} de {formatMoney(amount)}
          </p>
          <h2 className="mt-1 text-[26px] font-semibold tracking-tight">¿En qué fue?</h2>
          <div className="mt-5 space-y-1.5">
            <Label htmlFor="anotar-descripcion">Descripción</Label>
            <Input
              id="anotar-descripcion"
              value={form.description}
              onChange={(event) => set({ description: event.target.value })}
              placeholder={expense ? 'Ej. almuerzo' : 'Ej. salario'}
              autoFocus
              autoComplete="off"
            />
          </div>

          <p className="mt-6 text-sm font-medium">Categoría</p>
          <button
            type="button"
            aria-pressed={form.category === AI}
            onClick={() => set({ category: AI })}
            className={cn(
              'mt-2 flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-violet',
              form.category === AI ? 'border-brand bg-brand-soft' : 'border-ink/10',
            )}
          >
            <Sparkles className="size-[22px] shrink-0 text-brand" aria-hidden="true" />
            <span className="text-[15px]">
              <strong className="block font-semibold">Que la IA la sugiera</strong>
              <span className="text-ink/70">La elige según la descripción</span>
            </span>
          </button>

          <p className="mt-4 text-sm text-ink/60">O elige una:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {shown.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  aria-pressed={form.category === c.key}
                  onClick={() => set({ category: c.key })}
                  className={cn(
                    'h-11 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                    form.category === c.key ? 'border-brand bg-brand-soft text-brand' : 'border-ink/15 bg-surface',
                  )}
                >
                  {c.name}
                </button>
              </li>
            ))}
            {!allCategories && list.length > VISIBLE_CATEGORIES && (
              <li>
                <button
                  type="button"
                  onClick={() => setAllCategories(true)}
                  className="h-11 rounded-full border border-ink/15 bg-surface px-3.5 text-sm font-medium text-brand focus-visible:outline-2 focus-visible:outline-violet"
                >
                  Ver todas
                </button>
              </li>
            )}
          </ul>

          <Button size="lg" className="mt-auto" disabled={!form.description.trim()} onClick={() => go('3')}>
            Continuar
          </Button>
        </>
      )}

      {step === '3' && (
        <>
          <h2 className="mt-5 text-[26px] font-semibold tracking-tight">Revisa y guarda</h2>
          <p className="mt-4 text-[42px] font-semibold leading-tight tracking-tight tabular-nums">{formatMoney(amount)}</p>
          <p className="mt-1 text-base text-ink/60">
            {form.description.trim()} · {categoryName}
          </p>

          <div className="mt-7">
            <DateQuickPick value={form.date} onChange={(date) => set({ date })} />
          </div>
          {expense && cards.data?.length > 0 && (
            <ChipGroup
              legend="Pagado con"
              className="mt-6"
              options={[
                { value: CASH, label: 'Efectivo o débito' },
                ...cards.data.map((c) => ({ value: c.id, label: `${NETWORK_LABELS[c.network] ?? c.name} ••${c.last4}` })),
              ]}
              value={form.card}
              onChange={(card) => set({ card })}
            />
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-negative">
              {error}
            </p>
          )}
          <Button size="lg" className="mt-auto" disabled={saving} onClick={save}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {expense ? 'Guardar gasto' : 'Guardar ingreso'}
          </Button>
        </>
      )}

      <VoiceEntry
        open={voice}
        autoStart
        names={names}
        onClose={() => setVoice(false)}
        onEdit={(draft) => {
          setVoice(false);
          if (!draft) return;
          set({
            type: draft.type,
            amount: draft.amount ? String(Math.round(draft.amount)) : form.amount,
            description: draft.description ?? '',
            date: draft.date ?? form.date,
          });
          if (draft.amount) go('2');
        }}
        onSaved={(saved) => {
          setVoice(false);
          if (saved.transaction || saved.offline) {
            navigate('/app', { replace: true });
          }
        }}
      />
    </div>
  );
}
