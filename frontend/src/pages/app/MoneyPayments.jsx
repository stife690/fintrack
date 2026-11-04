import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { currentMonth } from '@/components/budgets/month';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { dayAndMonth } from '@/lib/moneyPlan';
import { todayIso } from '@/lib/period';
import { TRANSACTION_SAVED_EVENT, saveNewTransaction } from '@/offline/saveNewTransaction';
import { CommitmentDialog, EMPTY_COMMITMENT, IncomeSection } from '@/pages/app/MiPlata';
import { deleteCommitment, getMoneyProfile, getPaymentCalendar, updateMoneyProfile } from '@/services/moneyProfileService';
import { toProfileData } from '@/lib/moneyProfile';

/**
 * Lo que falta y lo ya pagado este mes, a partir de los eventos del calendario.
 * @param {Array<{ kind: string, status: string|null, amount: number|null }>} events
 * @returns {{ pending: number, paid: number }}
 */
export function paymentTotals(events) {
  const mine = events.filter((e) => e.kind === 'compromiso');
  const sum = (list) => list.reduce((total, e) => total + (e.amount ?? 0), 0);
  return { pending: sum(mine.filter((e) => e.status !== 'pagado')), paid: sum(mine.filter((e) => e.status === 'pagado')) };
}

/** Página privada `/app/mi-plata/pagos`: cuándo llega la plata y los pagos del mes, por pagar y pagados. */
export default function MoneyPayments() {
  usePageTitle('Pagos del mes');
  const profile = useAsync(getMoneyProfile, []);
  const calendar = useAsync(() => getPaymentCalendar(currentMonth()), []);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const data = profile.data;
  const events = (calendar.data?.events ?? []).filter((e) => e.kind === 'compromiso');
  const totals = paymentTotals(events);
  const { reload: reloadCalendar } = calendar;

  useEffect(() => {
    window.addEventListener(TRANSACTION_SAVED_EVENT, reloadCalendar);
    return () => window.removeEventListener(TRANSACTION_SAVED_EVENT, reloadCalendar);
  }, [reloadCalendar]);

  const saveIncome = async (changes) => {
    const form = { incomeType: data.incomeType ?? '', payDays: data.payDays, balance: data.balance === null ? '' : String(data.balance), ...changes };
    await updateMoneyProfile(toProfileData(form));
    profile.reload();
  };

  const pay = async (event) => {
    setPaying(event.id);
    setError('');
    try {
      await saveNewTransaction({ type: 'gasto', amount: event.amount, description: event.name, date: todayIso(), category: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(null);
    }
  };

  if (!data) {
    if (profile.error) {
      return (
        <p role="alert" className="text-sm text-negative">
          {profile.error}{' '}
          <button type="button" className="underline" onClick={profile.reload}>
            Reintentar
          </button>
        </p>
      );
    }
    return (
      <p className="flex items-center gap-2 py-10 text-ink/60" aria-busy="true">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  }

  const commitmentById = Object.fromEntries(data.commitments.map((c) => [c.id, c]));
  const changed = () => {
    setForm(null);
    profile.reload();
    reloadCalendar();
  };
  const remove = async () => {
    setError('');
    try {
      await deleteCommitment(form.id);
      changed();
    } catch (err) {
      setForm(null);
      setError(err.message);
    }
  };
  const row = (event) => {
    const paid = event.status === 'pagado';
    const commitment = commitmentById[event.id];
    return (
      <li key={`${event.id}-${event.date}`} className="flex items-center gap-2 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{event.name}</p>
          <p className="text-sm tabular-nums text-ink/70">
            {formatMoney(event.amount)} · {dayAndMonth(event.date)}
            {event.status === 'atrasado' && <span className="font-medium text-negative"> · atrasado</span>}
          </p>
        </div>
        {paid ? (
          <span className="rounded-full bg-positive/15 px-2.5 py-1 text-[13px] font-semibold text-positive">Pagado</span>
        ) : (
          <Button variant="soft" size="sm" disabled={paying !== null} onClick={() => pay(event)}>
            {paying === event.id && <Loader2 className="animate-spin" aria-hidden="true" />}
            Ya lo pagué<span className="sr-only"> {event.name}</span>
          </Button>
        )}
        {commitment && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${event.name}`}
            onClick={() =>
              setForm({ id: commitment.id, name: commitment.name, amount: String(commitment.amount), dayOfMonth: String(commitment.dayOfMonth) })
            }
          >
            <Pencil aria-hidden="true" />
          </Button>
        )}
      </li>
    );
  };
  const group = (title, list) =>
    list.length > 0 && (
      <section aria-label={title}>
        <h2 className="mb-1.5 text-lg font-semibold tracking-tight">{title}</h2>
        <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-surface px-3.5">{list.map(row)}</ul>
      </section>
    );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Pagos del mes</h1>
        <p className="mt-1 text-[15px] text-ink/70">Lo que pagas cada mes y cuándo te llega la plata</p>
      </div>
      <IncomeSection title="Tu sueldo" profile={data} onSave={saveIncome} />
      {calendar.error && (
        <p role="alert" className="text-sm text-negative">
          {calendar.error}{' '}
          <button type="button" className="underline" onClick={reloadCalendar}>
            Reintentar
          </button>
        </p>
      )}
      {calendar.data && (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-ink/10 bg-surface p-3.5">
            <div>
              <p className="text-[13px] text-ink/70">Falta por pagar</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(totals.pending)}</p>
            </div>
            <div>
              <p className="text-[13px] text-ink/70">Ya pagaste</p>
              <p className="text-lg font-semibold tabular-nums text-positive">{formatMoney(totals.paid)}</p>
            </div>
          </div>
          {events.length === 0 && (
            <p className="text-sm text-ink/70">Agrega lo que pagas cada mes, como arriendo, internet o celular.</p>
          )}
          {group('Por pagar', events.filter((e) => e.status !== 'pagado'))}
          {group('Pagados', events.filter((e) => e.status === 'pagado'))}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <Button variant="soft" size="lg" onClick={() => setForm(EMPTY_COMMITMENT)}>
        <Plus aria-hidden="true" />
        Agregar pago
      </Button>
      <CommitmentDialog form={form} onClose={() => setForm(null)} onSaved={changed} onDelete={remove} />
    </div>
  );
}
