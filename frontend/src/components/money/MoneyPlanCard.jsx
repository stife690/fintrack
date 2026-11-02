import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { dayAndMonth, planHeadline } from '@/lib/moneyPlan';
import { todayIso } from '@/lib/period';
import { cn } from '@/lib/utils';
import { saveNewTransaction } from '@/offline/saveNewTransaction';

const MASK = '$ ••••••';

/** Fila de la cuenta bajo el número principal. */
function Row({ label, value, strong = false }) {
  return (
    <div className={cn('flex justify-between gap-3 text-sm', strong ? 'font-medium' : 'text-ink/60')}>
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/** Lo que falta por pagar, con el botón para marcarlo sin ir al formulario. */
function PendingPayments({ pending, onError }) {
  const [paying, setPaying] = useState(null);

  const pay = async ({ id, date, name, amount }) => {
    const key = `${id}-${date}`;
    setPaying(key);
    try {
      await saveNewTransaction({ type: 'gasto', amount, description: name, date: todayIso(), category: null });
    } catch (err) {
      onError(err.message);
    } finally {
      setPaying(null);
    }
  };

  return (
    <ul className="divide-y divide-ink/10">
      {pending.map((payment) => {
        const key = `${payment.id}-${payment.date}`;
        return (
          <li key={key} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{payment.name}</p>
              <p className="text-sm text-ink/60">
                {formatMoney(payment.amount)} · {dayAndMonth(payment.date)}
              </p>
            </div>
            <Button variant="soft" size="sm" disabled={paying !== null} onClick={() => pay(payment)}>
              {paying === key && <Loader2 className="animate-spin" aria-hidden="true" />}
              Ya lo pagué<span className="sr-only"> {payment.name}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Inicio → Mi plata (FT-0037): cuánto puede gastar hoy quien cobra con fecha fija, y cuánto necesita
 * hacer o cuánto le dura la plata a quien no. Los números los calcula la API.
 * @param {{ plan: object, hidden: boolean }} props `hidden`: ocultar montos, como el resto del inicio.
 */
export default function MoneyPlanCard({ plan, hidden }) {
  const [error, setError] = useState('');
  const money = (value) => (hidden ? MASK : formatMoney(value));
  const { label, value, note, warning } = planHeadline(plan, money);
  const fixed = plan.mode === 'daily';

  return (
    <Panel aria-labelledby="mi-plata-inicio">
      <h2 id="mi-plata-inicio" className="text-sm font-medium text-ink/70">
        {label}
      </h2>
      <p className={cn('mt-1 text-3xl font-semibold tracking-tight tabular-nums', warning && 'text-negative')}>{value}</p>
      <p className="mt-1 text-sm text-ink/60">{note}</p>

      <div className="mt-4 space-y-1.5 border-t border-ink/10 pt-3">
        <Row label="Tienes" value={money(plan.money)} />
        {plan.pendingTotal > 0 && (
          <Row label={fixed ? 'Compromisos antes del pago' : 'Compromisos pendientes'} value={`− ${money(plan.pendingTotal)}`} />
        )}
        <Row label="Libre" value={money(plan.free)} strong />
        {plan.mode === 'goal' && <Row label="Hoy llevas" value={money(plan.todayIncome)} />}
        {plan.mode === 'goal' && plan.usualIncome !== null && (
          <Row label="Sueles hacer" value={`${money(plan.usualIncome)} al día`} />
        )}
      </div>

      {plan.pending.length > 0 && (
        <div className="mt-3">
          <PendingPayments pending={plan.pending} onError={setError} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-negative">
          {error}
        </p>
      )}

      <p className="mt-3 text-sm text-ink/60">
        {!plan.hasCommitments && 'Aún sin compromisos: el número puede verse más alto. '}
        <Link to="/app/cuenta" className="font-medium text-brand hover:underline">
          {plan.hasCommitments ? 'Corregir saldo o pagos' : 'Agregar pagos'}
        </Link>
      </p>
    </Panel>
  );
}
