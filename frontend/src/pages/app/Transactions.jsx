import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CloudUpload, Download, Loader2, WifiOff } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import BudgetAlert from '@/components/transactions/BudgetAlert';
import TransactionFilters, { NO_FILTERS } from '@/components/transactions/TransactionFilters';
import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionList from '@/components/transactions/TransactionList';
import { formatDate, formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import usePageTitle from '@/hooks/usePageTitle';
import {
  SYNC_EVENT,
  cacheTransaction,
  listCached,
  listPending,
  queueCreate,
  uncacheTransaction,
} from '@/offline/sync';
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
 * Aviso de que el historial viene de la copia guardada en el dispositivo (FT-0009).
 * @param {{ syncedAt: string }} props Hora ISO de la última actualización, o `''` si nunca se llenó.
 */
function CachedNotice({ syncedAt }) {
  const when =
    syncedAt &&
    new Date(syncedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <p className="mt-2 flex items-start gap-2 rounded-xl bg-ink/5 px-3 py-2 text-sm text-ink/70">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {when
        ? `Sin conexión: ves la copia guardada en este dispositivo (actualizada el ${when}).`
        : 'Sin conexión: ves lo que está guardado en este dispositivo.'}
    </p>
  );
}

/**
 * Movimientos registrados sin conexión que esperan sincronizarse (FT-0009).
 * @param {{ operations: import('@/offline/db').PendingOperation[] }} props
 */
function PendingList({ operations }) {
  return (
    <section aria-labelledby="pending-title" className="mt-4 rounded-xl bg-brand-soft/60 p-4">
      <h3 id="pending-title" className="flex items-center gap-2 text-sm font-medium text-brand">
        <CloudUpload className="size-4" aria-hidden="true" />
        Pendientes de sincronizar ({operations.length})
      </h3>
      <ul className="mt-2 divide-y divide-ink/10">
        {operations.map(({ localId, transaction: t }) => (
          <li key={localId} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="min-w-0 break-words">
              {t.description} <span className="text-ink/60">· {formatDate(t.date)}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="sr-only">{t.type === 'ingreso' ? 'Ingreso de ' : 'Gasto de '}</span>
              <span aria-hidden="true">{t.type === 'ingreso' ? '+' : '−'}</span>
              {formatMoney(t.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Página privada `/app/transacciones`: formulario de registro y listado con filtros
 * (tipo, categoría, rango de fechas) y paginación. FT-0002.
 * Sin conexión, los movimientos nuevos se guardan en el dispositivo y se sincronizan después (FT-0009).
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
  const [budgetAlert, setBudgetAlert] = useState({ alert: null, category: null }); // FT-0006
  const [version, setVersion] = useState(0); // se incrementa para forzar la recarga del listado
  const [pending, setPending] = useState([]);
  // Sin conexión se muestra la copia guardada en el dispositivo: hora de su última actualización
  // (`''` si nunca se ha llenado) o `null` cuando la lista viene del servidor.
  const [cachedAt, setCachedAt] = useState(null);

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
    const query = { ...filters, page, pageSize: PAGE_SIZE };
    listTransactions(query)
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setCachedAt(null);
        setError('');
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (err.code !== 'NETWORK_ERROR') return setError(err.message);
        // Sin conexión: la copia del historial guardada en el dispositivo (FT-0009).
        const cached = await listCached(query).catch(() => null);
        if (cancelled) return;
        if (!cached) return setError(err.message); // IndexedDB no disponible: error original
        setResult(cached);
        setCachedAt(cached.syncedAt ?? '');
        setError('');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, page, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Al volver la conexión, la lista se vuelve a pedir al servidor.
  useEffect(() => {
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, [reload]);

  // La cola offline cambia al registrar sin conexión y cuando una sincronización termina.
  useEffect(() => {
    const refresh = () => listPending().then(setPending);
    const onSync = ({ detail }) => {
      refresh();
      if (detail.synced?.length) {
        const n = detail.synced.length;
        setNotice(n === 1 ? 'Se sincronizó 1 movimiento guardado sin conexión.' : `Se sincronizaron ${n} movimientos guardados sin conexión.`);
        reload();
      }
      if (detail.rejected?.length) {
        setError('Algunos movimientos guardados sin conexión no eran válidos y no se pudieron sincronizar.');
      }
    };
    refresh();
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [reload]);

  const changeFilters = (changes) => {
    setFilters((f) => ({ ...f, ...changes }));
    setPage(1);
  };

  const handleSubmit = async (values) => {
    if (editing) {
      const changes = diff(editing, values);
      if (Object.keys(changes).length > 0) {
        const { transaction, alert } = await updateTransaction(editing.id, changes);
        setBudgetAlert({ alert, category: transaction.category });
        setNotice('Cambios guardados.');
        reload();
        // La copia local es un respaldo: si falla, se corrige en la próxima sincronización.
        cacheTransaction(transaction).catch(() => {});
      }
      setEditing(null);
      return;
    }
    let created;
    try {
      if (!navigator.onLine) throw Object.assign(new Error(), { code: 'NETWORK_ERROR' });
      created = await createTransaction(values);
    } catch (err) {
      if (err.code !== 'NETWORK_ERROR') throw err;
      await queueCreate(values);
      // Sin conexión no hay alerta de presupuesto: se calcula en el servidor.
      setBudgetAlert({ alert: null, category: null });
      setNotice('Guardado sin conexión. Se sincronizará cuando vuelva internet.');
      return;
    }
    const { transaction: saved, alert } = created;
    setBudgetAlert({ alert, category: saved.category });
    setNotice(savedMessage(saved, categoryNames));
    setPage(1);
    reload();
    cacheTransaction(saved).catch(() => {});
  };

  const handleDelete = async (transaction) => {
    try {
      await deleteTransaction(transaction.id);
      if (editing?.id === transaction.id) setEditing(null);
      setNotice('Movimiento eliminado.');
      uncacheTransaction(transaction.id).catch(() => {});
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
      <PageHeader
        title="Movimientos"
        description="Tus gastos e ingresos, con la categoría de cada uno."
        actions={
          <Button asChild variant="soft">
            <Link to="/app/transacciones/exportar">
              <Download aria-hidden="true" />
              Exportar reporte
            </Link>
          </Button>
        }
      />

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
          <BudgetAlert
            className="mt-4"
            alert={budgetAlert.alert}
            categoryName={categoryNames[budgetAlert.category]}
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
          {cachedAt !== null && <CachedNotice syncedAt={cachedAt} />}
          {pending.length > 0 && <PendingList operations={pending} />}
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
