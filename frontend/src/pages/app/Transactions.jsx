import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Logo from '@/components/common/Logo';
import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionList from '@/components/transactions/TransactionList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import usePageTitle from '@/hooks/usePageTitle';
import {
  createTransaction,
  deleteTransaction,
  getCategories,
  listTransactions,
  updateTransaction,
} from '@/services/transactionService';

const PAGE_SIZE = 10;
const NO_FILTERS = { type: '', category: '', from: '', to: '' };

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
    return 'Guardada sin clasificar: no pudimos sugerir una categoría. Puedes elegirla editando la transacción.';
  }
  const name = names[saved.category] ?? saved.category;
  return saved.source === 'ia' ? `Guardada en ${name} (sugerida por IA).` : `Guardada en ${name}.`;
}

/**
 * Página privada `/app/transacciones`: formulario de registro y listado con filtros
 * (tipo, categoría, rango de fechas) y paginación. FT-0002.
 */
export default function Transactions() {
  usePageTitle('Transacciones');
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

  const changeFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value, ...(name === 'type' && { category: '' }) }));
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
      setNotice('Transacción eliminada.');
      // Si era la última de la página, retrocede una para no quedar en una página vacía.
      if (result.data.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const filterCategories =
    filters.type === 'gasto'
      ? categories.expense
      : filters.type === 'ingreso'
        ? categories.income
        : [...categories.expense, ...categories.income];
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link to="/app">
            <ArrowLeft aria-hidden="true" />
            Volver
          </Link>
        </Button>
      </header>

      {/* grid-cols-1 fija una columna que no crece con el contenido (los campos de fecha nativos
          de Android son anchos y, sin esto, ensanchaban la página más que la pantalla). */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pb-16 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section aria-labelledby="form-title" className="h-fit min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h1 id="form-title" className="mb-5 text-xl font-semibold tracking-tight">
            {editing ? 'Editar transacción' : 'Registrar transacción'}
          </h1>
          <TransactionForm
            categories={categories}
            initial={editing}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </section>

        <section aria-labelledby="list-title" className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 id="list-title" className="text-xl font-semibold tracking-tight">
            Mis transacciones
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="f-type">Tipo</Label>
              <Select id="f-type" value={filters.type} onChange={(e) => changeFilter('type', e.target.value)}>
                <option value="">Todos</option>
                <option value="gasto">Gastos</option>
                <option value="ingreso">Ingresos</option>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="f-category">Categoría</Label>
              <Select id="f-category" value={filters.category} onChange={(e) => changeFilter('category', e.target.value)}>
                <option value="">Todas</option>
                {filterCategories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="f-from">Desde</Label>
              <Input id="f-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => changeFilter('from', e.target.value)} />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="f-to">Hasta</Label>
              <Input id="f-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => changeFilter('to', e.target.value)} />
            </div>
          </div>
          {hasFilters && (
            <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => (setFilters(NO_FILTERS), setPage(1))}>
              Quitar filtros
            </Button>
          )}

          <p role="status" className="mt-4 min-h-5 text-sm text-success">
            {notice}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}{' '}
              <button type="button" className="underline" onClick={reload}>
                Reintentar
              </button>
            </p>
          )}

          <div className="mt-2" aria-busy={loading}>
            {loading && result.data.length === 0 ? (
              <p className="flex items-center gap-2 py-10 text-white/60">
                <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
              </p>
            ) : result.data.length === 0 ? (
              <p className="py-10 text-center text-white/50">
                {hasFilters ? 'Ninguna transacción coincide con los filtros.' : 'Aún no tienes transacciones. Registra la primera.'}
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
        </section>
      </main>
    </div>
  );
}
