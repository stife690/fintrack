import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { dayAndMonth } from '@/lib/moneyPlan';
import { todayIso } from '@/lib/period';
import { saveNewTransaction } from '@/offline/saveNewTransaction';

/**
 * Pagos pendientes de Mi plata, con el botón para marcarlos sin ir al formulario (FT-0037).
 * @param {{ pending: Array<{ id: string, name: string, amount: number, date: string }> }} props
 */
export default function PendingPayments({ pending }) {
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');

  const pay = async ({ id, date, name, amount }) => {
    setPaying(`${id}-${date}`);
    setError('');
    try {
      await saveNewTransaction({ type: 'gasto', amount, description: name, date: todayIso(), category: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(null);
    }
  };

  return (
    <Panel aria-labelledby="pagos-pendientes">
      <h2 id="pagos-pendientes" className="font-semibold tracking-tight">
        Pagos pendientes
      </h2>
      <ul className="mt-1 divide-y divide-ink/10">
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
      {error && (
        <p role="alert" className="mt-2 text-sm text-negative">
          {error}
        </p>
      )}
    </Panel>
  );
}
