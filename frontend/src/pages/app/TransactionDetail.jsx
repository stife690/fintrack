import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { cardMark } from '@/components/cards/cardFormat';
import ConfirmButton from '@/components/common/ConfirmButton';
import { MASK } from '@/components/dashboard/BalanceCard';
import Panel from '@/components/layout/Panel';
import AttachmentsPanel from '@/components/transactions/AttachmentsPanel';
import { formatDate, formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import usePageTitle from '@/hooks/usePageTitle';
import { canGoBack } from '@/lib/backPath';
import { cn } from '@/lib/utils';
import { removeTransaction } from '@/offline/removeTransaction';
import { getTransaction } from '@/services/transactionService';

/** "Hoy, 4 nov 2026" o, si no es hoy ni ayer, solo la fecha. */
function longDay(iso) {
  const near = formatRelativeDay(iso);
  return near === 'Hoy' || near === 'Ayer' ? `${near}, ${formatDate(iso)}` : formatDate(iso);
}

/**
 * Página privada `/app/transacciones/:id`: un movimiento con su categoría, fecha, con qué se pagó y sus
 * recibos, para editarlo o eliminarlo. Desde una lista llega con el movimiento en la navegación, así
 * abre también sin conexión; con un enlace directo lo pide al servidor.
 */
export default function TransactionDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const passed = state?.transaction?.id === id ? state.transaction : null;
  const fetched = useAsync(() => (passed ? Promise.resolve(passed) : getTransaction(id)), [id, passed]);
  const t = fetched.data;
  const { names } = useCategoryNames();
  const [hidden] = useHiddenAmounts();
  const [error, setError] = useState('');
  usePageTitle(t ? t.description : 'Movimiento');

  if (!t) {
    return fetched.error ? (
      <p role="alert" className="text-sm text-negative">
        {fetched.error}{' '}
        <button type="button" className="underline" onClick={fetched.reload}>
          Reintentar
        </button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-10 text-ink/60" aria-busy="true">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  }

  const income = t.type === 'ingreso';
  const rows = [
    ['Categoría', t.category ? (names[t.category] ?? t.category) : 'Sin clasificar'],
    ['Fecha', longDay(t.date)],
    ...(income
      ? []
      : [['Pagado con', t.card ? (t.card.deleted ? 'Tarjeta eliminada' : cardMark(t.card)) : 'Efectivo o débito']]),
    ...(t.card && t.installments > 1 ? [['Cuotas', String(t.installments)]] : []),
  ];

  const remove = async () => {
    setError('');
    try {
      await removeTransaction(t);
      if (canGoBack(window.history.state)) navigate(-1);
      else navigate('/app/mi-plata', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-[15px] text-ink/60">{t.description}</h1>
        <p className={cn('mt-1 text-[42px] font-semibold leading-tight tracking-tight tabular-nums', income && 'text-positive')}>
          <span className="sr-only">{income ? 'Ingreso de ' : 'Gasto de '}</span>
          {hidden ? MASK : `${income ? '+' : '−'}${formatMoney(t.amount)}`}
        </p>
      </div>

      <Panel className="py-0 md:py-0">
        <dl className="divide-y divide-ink/10">
          {rows.map(([label, value]) => (
            <div key={label} className="flex min-h-14 items-center justify-between gap-4 text-[15px]">
              <dt className="text-ink/60">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {/* Recibos (FT-0044): solo de movimientos que ya están en el servidor. */}
      <Panel>
        <AttachmentsPanel transactionId={t.id} />
      </Panel>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={() => navigate('/app/transacciones', { state: { editTransaction: t } })}>
          <Pencil aria-hidden="true" />
          Editar
        </Button>
        <ConfirmButton
          label="Eliminar"
          question="¿Eliminar este movimiento?"
          confirmLabel="Sí, eliminar"
          icon={Trash2}
          onConfirm={remove}
        />
      </div>
    </div>
  );
}
