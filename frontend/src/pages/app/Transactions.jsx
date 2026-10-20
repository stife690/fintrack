import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import TransactionFilters, { NO_FILTERS } from '@/components/transactions/TransactionFilters';
import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionList from '@/components/transactions/TransactionList';
import usePageTitle from '@/hooks/usePageTitle';
import {
  createTransaction,
  deleteTransaction,
  getCategories,
  listTransactions,
  updateTransaction,
} from '@/services/transactionService';

const PAGE_SIZE = 10;

/**
 * Calcula qué campos cambiaron al editar. Si el usuario deja la categoría en
 * "Que la IA la sugiera" se envía `category: null` y la API vuelve a categorizar.
 * @param {import('@/services/transactionService').Transaction} initial
 * @param {{ type: string, amount: number, description: string, date: string, category: string|null }} values
 * @returns {Partial<typeof values>}
 */
function diff(initial, values) {
  const changes = {};
  for (const field of ['type', 'amount', 'description', 'date']) {
    if (values[field] !== initial[field]) changes[field] = values[field];
  }
  if (values.category !== initial.category) changes.category = values.category;
  return changes;
}

/**
 * Mensaje de confirmación tras registrar una transacción, según cómo quedó la categoría.
 * @param {import('@/services/transactionService').Transaction} saved
 * @param {Record<string, string>} names
 * @returns {string}
 */
function savedMessage(saved, names) {
  if (saved.source === 'sin_clasificar') {
    return 'Guardado sin clasificar: no pudimos sugerir una categoría. Puedes elegirla editando el movimiento.';
  }
  const name = names[saved.category] ?? saved.category;
  return saved.source === 'ia' ? `Guardado en ${name} (sugerida por IA).` : `Guardado en ${name}.`;
}

/**
 * Página privada `/app/transacciones`: formulario de registro y listado con filtros
 * (tipo, categoría, rango de fechas) y paginación. FT-0002.
 */
export default function Transactions() {
  usePageTitle('Movimientos');
  // `?nuevo=gasto|ingreso` llega desde los accesos rápidos del inicio.
  const [searchParams] = useSearchParams();
  const quickType = searchParams.get('nuevo');
  const defaultType = quickType === 'ingreso' ? 'ingreso' : 'gasto';
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [version, setVersion] = useState(0); // se incrementa para forzar la recarga del listado

  const categoryNames = useMemo(
    () => Object.fromEntries([...categories.expense, ...categories.income].map((c) => [c.key, c.name])),
    [categories],
  );

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTransactions({ ...filters, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, page, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const changeFilters = (changes) => {
    setFilters((f) => ({ ...f, ...changes }));
    setPage(1);
  };

  const handleSubmit = async (values) => {
    if (editing) {
      const changes = diff(editing, values);
      if (Object.keys(changes).length > 0) {
        await updateTransaction(editing.id, changes);
        setNotice('Cambios guardados.');
        reload();
      }
      setEditing(null);
      return;
    }
    const saved = await createTransaction(values);
    setNotice(savedMessage(saved, categoryNames));
    setPage(1);
    reload();
  };

  const handleDelete = async (transaction) => {
    try {
      await deleteTransaction(transaction.id);
      if (editing?.id === transaction.id) setEditing(null);
      setNotice('Movimiento eliminado.');
      // Si era la última de la página, retrocede una para no quedar en una página vacía.
      if (result.data.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader title="Movimientos" description="Tus gastos e ingresos, con la categoría de cada uno." />

      {/* grid-cols-1 fija una columna que no crece con el contenido (los campos de fecha nativos
          de Android son anchos y, sin esto, ensanchaban la página más que la pantalla). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Panel aria-labelledby="form-title" className="h-fit lg:sticky lg:top-8">
          <h2 id="form-title" className="mb-5 text-lg font-semibold tracking-tight">
            {editing ? 'Editar movimiento' : 'Nuevo movimiento'}
          </h2>
          <TransactionForm
            categories={categories}
            initial={editing}
            defaultType={defaultType}
            autoFocus={Boolean(quickType)}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </Panel>

        <Panel aria-labelledby="list-title">
          <h2 id="list-title" className="text-lg font-semibold tracking-tight">
            Historial
          </h2>

          <div className="mt-4">
            <TransactionFilters filters={filters} categories={categories} onChange={changeFilters} />
          </div>

          <p role="status" className="mt-4 min-h-5 text-sm text-positive">
            {notice}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-negative">
              {error}{' '}
              <button type="button" className="underline" onClick={reload}>
                Reintentar
              </button>
            </p>
          )}

          <div className="mt-2" aria-busy={loading}>
            {loading && result.data.length === 0 ? (
              <p className="flex items-center gap-2 py-10 text-ink/60">
                <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
              </p>
            ) : result.data.length === 0 ? (
              <p className="py-10 text-center text-ink/50">
                {hasFilters ? 'Ningún movimiento coincide con los filtros.' : 'Aún no tienes movimientos. Registra el primero con el formulario.'}
              </p>
            ) : (
              <TransactionList
                transactions={result.data}
                categoryNames={categoryNames}
                page={page}
                pageSize={PAGE_SIZE}
                total={result.total}
                onPageChange={setPage}
                onEdit={(t) => (setEditing(t), setNotice(''), window.scrollTo({ top: 0, behavior: 'smooth' }))}
                onDelete={handleDelete}
              />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
