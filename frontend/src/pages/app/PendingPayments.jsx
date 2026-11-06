import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import CategoryPicker, { AUTO_CATEGORY } from '@/components/categories/CategoryPicker';
import Sheet from '@/components/common/Sheet';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { MASK } from '@/components/dashboard/BalanceCard';
import { formatDate, formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useAsync from '@/hooks/useAsync';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { confirmPendingPayment, discardPendingPayment, listPendingPayments } from '@/services/pendingPaymentService';
import { getCategories } from '@/services/transactionService';

/**
 * Hoja "Confirmar pago": se puede cambiar la descripción y elegir la categoría (o dejar que la IA la elija).
 * @param {{ payment: object, money: (n: number) => string, disabled: boolean, onConfirm: (data: object) => Promise<void> }} props
 */
export function ConfirmForm({ payment, money, disabled, onConfirm }) {
  const categories = useAsync(getCategories, []);
  const [description, setDescription] = useState(payment.merchant);
  const [category, setCategory] = useState(AUTO_CATEGORY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const text = description.trim();
    if (!text) {
      setError('Escribe una descripción');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm({ description: text, ...(category ? { category } : {}) });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <p>
        Se anota un gasto de <span className="font-semibold tabular-nums">{money(payment.amount)}</span> con fecha{' '}
        {formatDate(payment.date)}.
      </p>
      <FormField id="pp-description" label="Descripción">
        <Input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
      </FormField>
      {categories.data ? (
        <>
          <CategoryPicker
            legend="Categoría"
            categories={categories.data.expense}
            value={category}
            onChange={setCategory}
            allowAuto
            disabled={busy}
          />
          {category === AUTO_CATEGORY && (
            <p className="-mt-3 flex items-center gap-1.5 text-sm text-ink/60">
              <Sparkles className="size-4 shrink-0 text-brand" aria-hidden="true" />
              La clasificamos por ti al guardar.
            </p>
          )}
        </>
      ) : (
        !categories.error && (
          <p className="flex items-center gap-2 text-sm text-ink/60">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando categorías…
          </p>
        )
      )}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        Anotar el gasto
      </Button>
    </form>
  );
}

/**
 * Un pago de la lista.
 * @param {{ payment: object, money: (n: number) => string, online: boolean, busy: boolean, onConfirm: () => void, onDiscard: () => void }} props
 */
export function PaymentRow({ payment, money, online, busy, onConfirm, onDiscard }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="break-words font-medium">{payment.merchant}</span>
          <span className="font-semibold tabular-nums">{money(payment.amount)}</span>
        </p>
        <p className="mt-0.5 text-sm text-ink/60">
          {formatRelativeDay(payment.date)}
          {payment.card && ` · ${payment.card}`}
        </p>
        {payment.possibleDuplicate && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            Puede que ya lo hayas anotado: hay un gasto igual por esos días.
          </p>
        )}
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <Button size="sm" className="flex-1 sm:flex-none" onClick={onConfirm} disabled={!online || busy}>
          <Check aria-hidden="true" /> Confirmar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={onDiscard}
          disabled={!online || busy}
          aria-label={`Descartar el pago en ${payment.merchant}`}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />} Descartar
        </Button>
      </div>
    </li>
  );
}

/** Página privada `/app/por-confirmar`: pagos con Apple Pay que esperan aprobación (FT-0047). */
export default function PendingPayments() {
  usePageTitle('Por confirmar');
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const money = (n) => (hidden ? MASK : formatMoney(n));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null); // pago que se está confirmando
  const [discarding, setDiscarding] = useState(null);
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    listPendingPayments()
      .then((res) => !cancelled && (setData(res), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const handleConfirm = async (values) => {
    const { transaction } = await confirmPendingPayment(sheet.id, values);
    setNotice(`Anotado: ${transaction.description}, ${money(transaction.amount)}.`);
    setSheet(null);
    reload();
  };
  const handleDiscard = async (payment) => {
    setDiscarding(payment.id);
    setNotice('');
    try {
      await discardPendingPayment(payment.id);
      setNotice(`Descartado: ${payment.merchant}. No se anotó nada.`);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setDiscarding(null);
    }
  };

  const total = data?.items.reduce((sum, p) => sum + p.amount, 0) ?? 0;

  return (
    <>
      <PageHeader title="Por confirmar" description="Pagos con Apple Pay que llegaron desde tu iPhone." />
      {!online && <p className="mb-3 text-sm text-ink/60">Necesitas conexión para ver o confirmar tus pagos.</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={reload}>
            Reintentar
          </button>
        </p>
      )}
      {data === null && !error && (
        <p className="flex items-center gap-2 py-10 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}
      {data && (
        <div className="mx-auto max-w-2xl space-y-6">
          {notice && (
            <p role="status" className="rounded-xl bg-brand-soft p-3 text-sm text-brand">
              {notice}{' '}
              <Link to="/app/mi-plata" className="underline">
                Ver movimientos
              </Link>
            </p>
          )}
          {data.items.length === 0 ? (
            <Panel className="text-center">
              <p className="mx-auto max-w-md text-ink/60">
                No hay pagos por revisar. Cuando pagues con Apple Pay, el pago llega aquí y tú decides si se anota.
              </p>
              <Button asChild variant="soft" className="mt-4">
                <Link to="/app/cuenta">Conectar mi iPhone</Link>
              </Button>
            </Panel>
          ) : (
            <>
              <Panel>
                <p className="text-sm text-ink/60">
                  {data.items.length === 1 ? '1 pago sin revisar' : `${data.items.length} pagos sin revisar`}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums md:text-2xl">{money(total)}</p>
              </Panel>
              <ul aria-label="Pagos por confirmar" className="space-y-2">
                {data.items.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    money={money}
                    online={online}
                    busy={discarding === p.id}
                    onConfirm={() => (setNotice(''), setSheet(p))}
                    onDiscard={() => handleDiscard(p)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <Sheet open={sheet !== null} title="Confirmar pago" onClose={() => setSheet(null)}>
        {sheet && <ConfirmForm key={sheet.id} payment={sheet} money={money} disabled={!online} onConfirm={handleConfirm} />}
      </Sheet>
    </>
  );
}
