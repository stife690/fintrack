import { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { paymentKey, readDismissed, saveDismissed, visiblePayments } from '@/lib/dismissedPayments';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { dayAndMonth } from '@/lib/moneyPlan';
import { todayIso } from '@/lib/period';
import { saveNewTransaction } from '@/offline/saveNewTransaction';

const EASE = [0.32, 0.72, 0, 1];

/**
 * Pagos pendientes de Mi plata, con el botón para marcarlos sin ir al formulario (FT-0037).
 * @param {{ pending: Array<{ id: string, name: string, amount: number, date: string }>, notice?: boolean }} props
 *   `notice`: solo el más próximo, como un aviso.
 */
export default function PendingPayments({ pending, notice = false }) {
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(readDismissed);

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

  if (notice) {
    const visible = visiblePayments(pending, dismissed);
    const payment = visible[0];
    const key = payment && paymentKey(payment);
    const close = () => {
      const next = [...dismissed, key];
      setDismissed(next);
      saveDismissed(next);
    };
    return (
      <MotionConfig reducedMotion="user">
        <AnimatePresence initial={false}>
          {payment && (
            <motion.div
              key="avisos"
              // Al irse el último, el espacio se cierra y lo de abajo sube; el margen cancela el `gap` de la página.
              exit={{ height: 0, opacity: 0, marginBottom: -20, transition: { duration: 0.26, ease: EASE } }}
              className="-mx-4 flex flex-col items-center overflow-hidden px-4"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 60, transition: { duration: 0.14, ease: 'easeIn' } }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="relative z-20 w-full rounded-2xl bg-brand-soft p-3.5 pt-4"
                >
<button
                      type="button"
                      aria-label={`Cerrar el aviso de ${payment.name}`}
                      onClick={close}
                      className="absolute right-0.5 top-0.5 grid size-9 place-items-center text-ink/70 focus-visible:outline-2 focus-visible:outline-violet"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                    <div className="flex items-end gap-3">
                      <p className="min-w-0 flex-1 text-[15px]">
                        {visible.length > 1 && <span className="block text-xs font-medium text-ink/70">1 de {visible.length}</span>}
                        <strong className="block font-semibold">
                          {payment.name} vence el {dayAndMonth(payment.date)}
                        </strong>
                        {formatMoney(payment.amount)}
                      </p>
                      <button
                        type="button"
                        disabled={paying !== null}
                        onClick={() => pay(payment)}
                        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3.5 text-sm font-semibold text-brand disabled:opacity-60"
                      >
                        {paying === key && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        Ya lo pagué<span className="sr-only"> {payment.name}</span>
                      </button>
                    </div>
                    {error && (
                      <p role="alert" className="mt-2 text-sm text-negative">
                        {error}
                      </p>
                    )}
                </motion.div>
              </AnimatePresence>
              <span
                aria-hidden="true"
                className={cn('relative z-10 -mt-3 h-[18px] w-[93%] rounded-b-xl bg-ink/10 transition-opacity', visible.length < 2 && 'opacity-0')}
              />
              <span
                aria-hidden="true"
                className={cn('-mt-3 h-[18px] w-[85%] rounded-b-xl border border-ink/10 bg-ink/5 transition-opacity', visible.length < 3 && 'opacity-0')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    );
  }

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
