import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import MovementRow from '@/components/transactions/MovementRow';
import useAsync from '@/hooks/useAsync';
import useFreshIds from '@/hooks/useFreshIds';
import { listCached } from '@/offline/sync';
import { TRANSACTION_SAVED_EVENT } from '@/offline/saveNewTransaction';
import { listTransactions } from '@/services/transactionService';

const PAGE_SIZE = 50;

/**
 * Movimientos con un filtro fijo (ingresos del periodo, gastos de un presupuesto). Sin conexión usa la
 * copia del dispositivo.
 * @param {{ filters: { type?: string, category?: string, from?: string, to?: string }, names: Record<string, string>, hidden?: boolean, empty: string }} props
 */
export default function FilteredMovements({ filters, names, hidden = false, empty }) {
  const key = JSON.stringify(filters);
  const { data, error, loading, reload } = useAsync(() => {
    const query = { ...JSON.parse(key), page: 1, pageSize: PAGE_SIZE };
    return listTransactions(query).catch((err) => {
      if (err.code !== 'NETWORK_ERROR') throw err;
      return listCached(query);
    });
  }, [key]);

  const fresh = useFreshIds(data?.data);

  useEffect(() => {
    window.addEventListener(TRANSACTION_SAVED_EVENT, reload);
    return () => window.removeEventListener(TRANSACTION_SAVED_EVENT, reload);
  }, [reload]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-negative">
        {error}{' '}
        <button type="button" className="underline" onClick={reload}>
          Reintentar
        </button>
      </p>
    );
  }
  if (loading && !data) {
    return (
      <p className="flex items-center gap-2 py-4 text-ink/60" aria-busy="true">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  }
  if (!data?.data.length) return <p className="py-3 text-sm text-ink/60">{empty}</p>;
  return (
    <Panel className="px-3.5 py-0 md:px-3.5 md:py-0">
      <ul className="divide-y divide-ink/10">
        {data.data.map((t) => (
          <MovementRow key={t.id} transaction={t} names={names} hidden={hidden} withDay icon fresh={fresh.has(t.id)} />
        ))}
      </ul>
    </Panel>
  );
}
