import { useState } from 'react';
import { Pencil, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate, formatMoney } from './format';

/**
 * Fila de una transacción con su categoría, origen de la categoría y acciones.
 * @param {object} props
 * @param {import('@/services/transactionService').Transaction} props.transaction
 * @param {Record<string, string>} props.categoryNames Nombre legible por clave de categoría.
 * @param {(t: import('@/services/transactionService').Transaction) => void} props.onEdit
 * @param {(t: import('@/services/transactionService').Transaction) => Promise<void>} props.onDelete
 */
function Row({ transaction: t, categoryNames, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const income = t.type === 'ingreso';

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete(t);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate font-medium">{t.description}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/50">
          <span>{formatDate(t.date)}</span>
          <span aria-hidden="true">·</span>
          <span className={t.category ? '' : 'italic'}>
            {t.category ? categoryNames[t.category] ?? t.category : 'Sin clasificar'}
          </span>
          {t.source === 'ia' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">
              <Sparkles className="size-3" aria-hidden="true" />
              Sugerida por IA
            </span>
          )}
        </p>
      </div>

      <p className={cn('text-lg font-semibold tabular-nums', income ? 'text-positive' : 'text-ink')}>
        <span className="sr-only">{income ? 'Ingreso de ' : 'Gasto de '}</span>
        {income ? '+' : '−'}
        {formatMoney(t.amount)}
      </p>

      <div className="flex items-center gap-1">
        {confirming ? (
          <>
            <span className="mr-1 text-sm text-ink/60">¿Eliminar?</span>
            <Button size="sm" variant="outline" onClick={remove} disabled={busy}>
              Sí, eliminar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              No
            </Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" onClick={() => onEdit(t)} aria-label={`Editar ${t.description}`}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Eliminar ${t.description}`}>
              <Trash2 aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Listado de transacciones con paginación. Los filtros viven en la página.
 *
 * @param {object} props
 * @param {import('@/services/transactionService').Transaction[]} props.transactions
 * @param {Record<string, string>} props.categoryNames Nombre legible por clave de categoría.
 * @param {number} props.page Página actual (desde 1).
 * @param {number} props.pageSize
 * @param {number} props.total Total de transacciones que cumplen los filtros.
 * @param {(page: number) => void} props.onPageChange
 * @param {(t: import('@/services/transactionService').Transaction) => void} props.onEdit
 * @param {(t: import('@/services/transactionService').Transaction) => Promise<void>} props.onDelete
 */
export default function TransactionList({
  transactions,
  categoryNames,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <ul className="divide-y divide-ink/10">
        {transactions.map((t) => (
          <Row key={t.id} transaction={t} categoryNames={categoryNames} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Paginación">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-ink/60">
            Página {page} de {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            Siguiente
          </Button>
        </nav>
      )}
    </div>
  );
}
