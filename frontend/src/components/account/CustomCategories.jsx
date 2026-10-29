import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import CategoryIcon from '@/components/categories/CategoryIcon';
import NewCategoryDialog, { deletedMessage } from '@/components/categories/NewCategoryDialog';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import {
  CATEGORIES_CHANGED_EVENT,
  applyCategoryChange,
  deleteCategory,
  getCategories,
} from '@/services/transactionService';

/** Categorías propias que puede tener cada usuario (igual que en la API). */
export const MAX_OWN = 20;

/**
 * Una categoría propia con sus acciones. Eliminar pide confirmación en la misma fila, como los
 * movimientos y los presupuestos.
 */
function CategoryRow({ category, onEdit, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const { moved } = await deleteCategory(category.key);
      onDeleted(category, moved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <CategoryIcon category={category.key} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{category.name}</p>
        <p className="text-sm text-ink/60">{category.type === 'gasto' ? 'Gasto' : 'Ingreso'}</p>
        {confirming && (
          <p className="mt-1 text-sm text-ink/70">
            Sus movimientos pasarán a {category.type === 'gasto' ? 'Otros' : 'Otros ingresos'} y sus presupuestos se
            borrarán.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-sm text-negative">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {confirming ? (
          <>
            <span className="mr-1 text-sm text-ink/60">¿Eliminar?</span>
            <Button size="sm" variant="outline" onClick={remove} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              Sí, eliminar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              No
            </Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" onClick={() => onEdit(category)} aria-label={`Editar ${category.name}`}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setConfirming(true)}
              aria-label={`Eliminar ${category.name}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Cuenta → "Mis categorías": las categorías propias del usuario para crear, editar y eliminar.
 * Las 15 de todos no aparecen porque no se pueden cambiar.
 */
export default function CustomCategories() {
  const [categories, setCategories] = useState(null); // null mientras carga
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [dialog, setDialog] = useState(null); // { category? } con la ventana abierta

  useEffect(() => {
    getCategories()
      .then((all) =>
        setCategories([
          ...all.expense.filter((c) => c.custom).map((c) => ({ ...c, type: 'gasto' })),
          ...all.income.filter((c) => c.custom).map((c) => ({ ...c, type: 'ingreso' })),
        ]),
      )
      .catch((err) => setError(err.message));
  }, []);

  // Lo creado, editado o eliminado aquí o desde Movimientos o Presupuestos se refleja en la lista.
  useEffect(() => {
    const apply = ({ detail }) =>
      setCategories((current) => current && applyCategoryChange(current, detail).filter((c) => c.custom));
    window.addEventListener(CATEGORIES_CHANGED_EVENT, apply);
    return () => window.removeEventListener(CATEGORIES_CHANGED_EVENT, apply);
  }, []);

  const saved = () => setStatus(dialog?.category ? 'Cambios guardados.' : 'Categoría creada.');
  const deleted = (category, moved) => setStatus(deletedMessage(moved, category.type));

  const count = categories?.length ?? 0;

  return (
    <Panel aria-labelledby="mis-categorias">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="mis-categorias" className="text-lg font-semibold tracking-tight">
            Mis categorías
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Además de las 15 de siempre, puedes crear hasta {MAX_OWN} propias.
            {categories && ` Tienes ${count} de ${MAX_OWN}.`}
          </p>
        </div>
        <Button
          variant="soft"
          onClick={() => {
            setStatus('');
            setDialog({});
          }}
          disabled={!categories || count >= MAX_OWN}
        >
          <Plus aria-hidden="true" />
          Nueva categoría
        </Button>
      </div>

      <p role="status" className="mt-3 text-sm text-positive empty:hidden">
        {status}
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-negative">
          {error}
        </p>
      ) : !categories ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink/60">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando tus categorías…
        </p>
      ) : count === 0 ? (
        <p className="mt-4 text-sm text-ink/70">
          Aún no tienes categorías propias. Créalas aquí o con el botón “Nueva” al registrar un movimiento o un
          presupuesto.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/10">
          {categories.map((category) => (
            <CategoryRow
              key={category.key}
              category={category}
              onEdit={(c) => {
                setStatus('');
                setDialog({ category: c });
              }}
              onDeleted={deleted}
            />
          ))}
        </ul>
      )}

      <NewCategoryDialog
        open={Boolean(dialog)}
        category={dialog?.category}
        onClose={() => setDialog(null)}
        onCreated={saved}
        onDeleted={deleted}
      />
    </Panel>
  );
}
