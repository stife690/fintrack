import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, WifiOff } from 'lucide-react';
import Logo from '@/components/common/Logo';
import BudgetForm from '@/components/budgets/BudgetForm';
import BudgetList from '@/components/budgets/BudgetList';
import { currentMonth, formatMonth, shiftMonth } from '@/components/budgets/month';
import { Button } from '@/components/ui/button';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { createBudget, deleteBudget, listBudgets, updateBudget } from '@/services/budgetService';
import { getCategories } from '@/services/transactionService';

/**
 * Página privada `/app/presupuestos`: crear, editar y eliminar presupuestos por categoría y
 * mes, con lo gastado y la alerta de cada uno (FT-0005, REQ-016 a REQ-019).
 * Necesita conexión: sin ella muestra un aviso y desactiva los cambios.
 */
export default function Budgets() {
  usePageTitle('Presupuestos');
  const online = useOnlineStatus();
  const [month, setMonth] = useState(currentMonth);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [version, setVersion] = useState(0); // se incrementa para forzar la recarga

  const monthLabel = formatMonth(month);
  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c.name])),
    [categories],
  );

  useEffect(() => {
    getCategories()
      .then((all) => setCategories(all.expense))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBudgets(month)
      .then((data) => {
        if (cancelled) return;
        setBudgets(data);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const changeMonth = (delta) => {
    setMonth((m) => shiftMonth(m, delta));
    setEditing(null);
    setNotice('');
  };

  const handleSubmit = async ({ category, amount }) => {
    if (editing) {
      await updateBudget(editing.id, amount);
      setNotice(`Límite de ${categoryNames[editing.category] ?? editing.category} actualizado.`);
      setEditing(null);
    } else {
      await createBudget({ category, month, amount });
      setNotice(`Presupuesto de ${categoryNames[category] ?? category} creado.`);
    }
    reload();
  };

  const handleDelete = async (budget) => {
    try {
      await deleteBudget(budget.id);
      if (editing?.id === budget.id) setEditing(null);
      setNotice(`Presupuesto de ${categoryNames[budget.category] ?? budget.category} eliminado.`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

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

      {!online && (
        <p
          role="status"
          className="mx-auto mb-6 flex max-w-6xl items-center gap-2 px-4 text-sm text-amber-300"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          Sin conexión. Los presupuestos se guardan en el servidor: podrás crearlos y cambiarlos
          cuando vuelvas a tener internet.
        </p>
      )}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pb-16 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section
          aria-labelledby="form-title"
          className="h-fit min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <h1 id="form-title" className="mb-5 text-xl font-semibold tracking-tight">
            {editing ? 'Cambiar límite' : 'Nuevo presupuesto'}
          </h1>
          <BudgetForm
            categories={categories}
            usedCategories={budgets.map((b) => b.category)}
            monthLabel={monthLabel}
            initial={editing}
            disabled={!online}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </section>

        <section
          aria-labelledby="list-title"
          className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <Button size="icon" variant="ghost" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <h2 id="list-title" className="text-center text-xl font-semibold tracking-tight first-letter:uppercase">
              {monthLabel}
            </h2>
            <Button size="icon" variant="ghost" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>

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
            {loading && budgets.length === 0 ? (
              <p className="flex items-center gap-2 py-10 text-white/60">
                <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
              </p>
            ) : budgets.length === 0 ? (
              <p className="py-10 text-center text-white/50">
                No tienes presupuestos en {monthLabel}. Crea uno para ver cuánto llevas gastado en
                esa categoría.
              </p>
            ) : (
              <BudgetList
                budgets={budgets}
                categoryNames={categoryNames}
                disabled={!online}
                onEdit={(b) => (setEditing(b), setNotice(''), window.scrollTo({ top: 0, behavior: 'smooth' }))}
                onDelete={handleDelete}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
