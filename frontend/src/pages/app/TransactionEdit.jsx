import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import BudgetAlert from '@/components/transactions/BudgetAlert';
import TransactionForm from '@/components/transactions/TransactionForm';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { canGoBack } from '@/lib/backPath';
import { saveNewTransaction } from '@/offline/saveNewTransaction';
import { cacheTransaction, queueUpdate } from '@/offline/sync';
import { listCards } from '@/services/cardService';
import {
  CATEGORIES_CHANGED_EVENT,
  applyCategoryChange,
  getCategories,
  getTransaction,
  updateTransaction,
} from '@/services/transactionService';

/**
 * Calcula qué campos cambiaron al editar. Si el usuario deja la categoría en
 * "Que la IA la sugiera" se envía `category: null` y la API vuelve a categorizar.
 * @param {import('@/services/transactionService').Transaction} initial
 * @param {{ type: string, amount: number, description: string, date: string, category: string|null, card: string|null, installments: number|null }} values
 * @returns {Partial<typeof values>}
 */
export function changedFields(initial, values) {
  const changes = {};
  for (const field of ['type', 'amount', 'description', 'date']) {
    if (values[field] !== initial[field]) changes[field] = values[field];
  }
  if (values.category !== initial.category) changes.category = values.category;
  // Una tarjeta eliminada cuenta como "sin tarjeta": el formulario no la ofrece.
  const wasCard = initial.card && !initial.card.deleted ? initial.card.id : null;
  if (values.card !== wasCard) changes.card = values.card;
  if (values.installments !== (wasCard ? initial.installments : null)) changes.installments = values.installments;
  return changes;
}

/**
 * Mensaje de confirmación tras registrar una transacción, según cómo quedó la categoría.
 * @param {import('@/services/transactionService').Transaction} saved
 * @param {Record<string, string>} names
 * @returns {string}
 */
export function savedMessage(saved, names) {
  if (saved.source === 'sin_clasificar') {
    return 'Guardado sin clasificar: no pudimos sugerir una categoría. Puedes elegirla editando el movimiento.';
  }
  const name = names[saved.category] ?? saved.category;
  return saved.source === 'ia' ? `Guardado en ${name} (sugerida por IA).` : `Guardado en ${name}.`;
}

/**
 * Formulario completo de un movimiento, con tarjeta y cuotas.
 * `/app/transacciones/:id/editar` edita uno existente; desde el detalle llega en la navegación, así abre
 * también sin conexión. `/app/transacciones/nuevo` revisa lo dictado en la barra rápida antes de guardarlo.
 */
export default function TransactionEdit() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const passed = id && state?.transaction?.id === id ? state.transaction : null;
  const fetched = useAsync(() => (!id || passed ? Promise.resolve(passed) : getTransaction(id)), [id, passed]);
  const editing = id ? fetched.data : null;
  const draft = id ? null : (state?.voiceDraft ?? null);
  usePageTitle(id ? 'Editar movimiento' : 'Nuevo movimiento');

  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [cards, setCards] = useState([]);
  const [error, setError] = useState('');
  // Resultado de guardar: `offline` decide a dónde vuelve, porque el detalle aún no tendría el cambio.
  const [done, setDone] = useState(null);
  const names = useMemo(
    () => Object.fromEntries([...categories.expense, ...categories.income].map((c) => [c.key, c.name])),
    [categories],
  );

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => setError(err.message));
    // Sin tarjetas (o sin red ni copia) la fila "Pagado con" simplemente no aparece.
    listCards()
      .then(setCards)
      .catch(() => {});
    const apply = ({ detail }) =>
      setCategories((current) => ({
        expense: applyCategoryChange(current.expense, detail, 'gasto'),
        income: applyCategoryChange(current.income, detail, 'ingreso'),
      }));
    window.addEventListener(CATEGORIES_CHANGED_EVENT, apply);
    return () => window.removeEventListener(CATEGORIES_CHANGED_EVENT, apply);
  }, []);

  const leave = (offline = false) => {
    if (!offline && canGoBack(window.history.state)) navigate(-1);
    else navigate('/app/mi-plata', { replace: true });
  };

  const submit = async (values) => {
    if (!id) {
      const { transaction, alert, offline } = await saveNewTransaction(values);
      setDone({
        offline,
        message: offline ? 'Guardado sin conexión. Se sincronizará cuando vuelva internet.' : savedMessage(transaction, names),
        alert: offline ? null : alert,
        category: transaction.category,
      });
      return;
    }
    const changes = changedFields(editing, values);
    if (Object.keys(changes).length === 0) return leave();
    let updated;
    try {
      if (!navigator.onLine) throw Object.assign(new Error(), { code: 'NETWORK_ERROR' });
      updated = await updateTransaction(editing.id, changes);
    } catch (err) {
      if (err.code !== 'NETWORK_ERROR') throw err;
      await queueUpdate(editing, changes, cards.find((c) => c.id === changes.card));
      setDone({ offline: true, message: 'Cambios guardados sin conexión. Se sincronizarán cuando vuelva internet.' });
      return;
    }
    // La copia local es un respaldo: si falla, se corrige en la próxima sincronización.
    cacheTransaction(updated.transaction).catch(() => {});
    setDone({ offline: false, message: 'Cambios guardados.', alert: updated.alert, category: updated.transaction.category });
  };

  if (id && !editing) {
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

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 text-[28px] font-semibold tracking-tight">{id ? 'Editar movimiento' : 'Nuevo movimiento'}</h1>
      {done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-xl bg-brand-soft px-3 py-2.5 text-[15px]">
            {done.message}
          </p>
          <BudgetAlert alert={done.alert} categoryName={names[done.category]} />
          <Button size="lg" onClick={() => leave(done.offline)}>
            Listo
          </Button>
        </div>
      ) : (
        <Panel>
          {draft && (
            <p role="status" className="mb-4 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand">
              Revisa lo que anotaste y toca Guardar.
            </p>
          )}
          {error && (
            <p role="alert" className="mb-4 text-sm text-negative">
              {error}
            </p>
          )}
          <TransactionForm
            categories={categories}
            cards={cards}
            initial={editing}
            defaultType={draft?.type === 'ingreso' ? 'ingreso' : 'gasto'}
            draft={draft}
            onSubmit={submit}
            onCancel={() => leave()}
          />
        </Panel>
      )}
    </div>
  );
}
