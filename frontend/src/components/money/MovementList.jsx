import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { currentMonth, formatMonth, shiftMonth } from '@/components/budgets/month';
import CategoryIcon from '@/components/categories/CategoryIcon';
import Sheet from '@/components/common/Sheet';
import useFreshIds from '@/hooks/useFreshIds';
import { cn } from '@/lib/utils';
import useCategoryNames from '@/hooks/useCategoryNames';
import { monthRange } from '@/services/summaryService';
import MovementRow from '@/components/transactions/MovementRow';
import { SEARCH_DELAY_MS } from '@/components/transactions/TransactionFilters';
import { formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { SYNC_EVENT, listCached, listPending } from '@/offline/sync';
import { TRANSACTION_SAVED_EVENT } from '@/offline/saveNewTransaction';
import { listTransactions } from '@/services/transactionService';

const PAGE_SIZE = 20;

/**
 * Agrupa los movimientos por día, en el orden en que llegan (del más reciente al más antiguo).
 * @param {Array<{ date: string }>} transactions
 * @param {Date} [now]
 * @returns {Array<{ day: string, items: typeof transactions }>}
 */
export function groupByDay(transactions, now = new Date()) {
  const groups = [];
  for (const t of transactions) {
    const last = groups.at(-1);
    if (last?.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, day: formatRelativeDay(t.date, now), items: [t] });
  }
  return groups;
}

const TYPES = [
  { value: '', label: 'Todos' },
  { value: 'gasto', label: 'Gastos' },
  { value: 'ingreso', label: 'Ingresos' },
];

const CHIP = 'flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet';
const chipTone = (selected) => (selected ? 'border-2 border-brand bg-brand-soft font-semibold text-brand' : 'border-ink/15 bg-surface');

/**
 * Movimientos dentro de Mi plata, en el celular: mes, buscador, filtros y la lista por día. Sin conexión
 * muestra la copia guardada en el dispositivo. Lo pendiente de sincronizar se abre en Movimientos.
 * @param {{ names: Record<string, string>, hidden?: boolean }} props
 */
export default function MovementList({ names, hidden = false }) {
  const [text, setText] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [picking, setPicking] = useState(false);
  const { categories } = useCategoryNames();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null); // `{ data, total }` con todas las páginas cargadas
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => (setQ(text.trim()), setPage(1)), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    const countPending = () => listPending().then((ops) => setPending(ops.length)).catch(() => {});
    const reload = () => (setPage(1), setVersion((v) => v + 1), countPending());
    countPending();
    window.addEventListener(TRANSACTION_SAVED_EVENT, reload);
    window.addEventListener(SYNC_EVENT, reload);
    window.addEventListener('online', reload);
    return () => {
      window.removeEventListener(TRANSACTION_SAVED_EVENT, reload);
      window.removeEventListener(SYNC_EVENT, reload);
      window.removeEventListener('online', reload);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const query = { q, type, category, ...monthRange(month), page, pageSize: PAGE_SIZE };
    listTransactions(query)
      .catch(async (err) => {
        if (err.code !== 'NETWORK_ERROR') throw err;
        const cached = await listCached(query).catch(() => null);
        if (!cached) throw err;
        return cached;
      })
      .then((res) => {
        if (cancelled) return;
        // "Ver más" suma la página siguiente a las que ya están.
        setResult((current) => (page === 1 || !current ? res : { ...res, data: [...current.data, ...res.data] }));
        setError('');
        setBusy(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, type, category, month, page, version]);

  const groups = useMemo(() => groupByDay(result?.data ?? []), [result]);
  const fresh = useFreshIds(result?.data);
  const monthName = formatMonth(month).replace(new RegExp(` de ${currentMonth().slice(0, 4)}$`), '');
  const expense = categories?.expense ?? [];
  const income = categories?.income ?? [];
  const categoryOptions = type === 'ingreso' ? income : type === 'gasto' ? expense : [...expense, ...income];
  const categoryName = [...expense, ...income].find((c) => c.key === category)?.name;
  const filtered = Boolean(q || type || category);

  const changeMonth = (delta) => {
    setMonth((m) => shiftMonth(m, delta));
    setPage(1);
  };

  const pickType = (value) => {
    setType(value);
    setCategory('');
    setPage(1);
  };

  return (
    <section id="movimientos" aria-labelledby="movimientos-title" className="scroll-mt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="movimientos-title" className="text-lg font-semibold tracking-tight">
          Movimientos
        </h2>
        <div className="-mr-2 flex items-center text-sm font-medium text-brand">
          <button type="button" aria-label="Mes anterior" className="grid size-11 place-items-center" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span aria-live="polite" className="first-letter:uppercase">{monthName}</span>
          <button
            type="button"
            aria-label="Mes siguiente"
            className="grid size-11 place-items-center disabled:opacity-40"
            disabled={month >= currentMonth()}
            onClick={() => changeMonth(1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <label className="mt-2 flex h-12 items-center gap-2.5 rounded-full bg-ink/5 px-4 text-ink/60 focus-within:ring-2 focus-within:ring-brand/40">
        <Search className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="sr-only">Buscar movimiento</span>
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Buscar movimiento"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/50"
        />
      </label>

      <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {TYPES.map(({ value, label }) => (
          <button key={label} type="button" aria-pressed={type === value} onClick={() => pickType(value)} className={cn(CHIP, chipTone(type === value))}>
            {label}
          </button>
        ))}
        <button type="button" aria-haspopup="dialog" onClick={() => setPicking(true)} className={cn(CHIP, chipTone(Boolean(category)))}>
          {categoryName ?? 'Categoría'}
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>
      <Sheet open={picking} title="Categoría" onClose={() => setPicking(false)}>
        <ul className="divide-y divide-ink/10">
          <li>
            <button type="button" className="flex min-h-14 w-full items-center gap-3 text-left font-medium" onClick={() => (setCategory(''), setPage(1), setPicking(false))}>
              Todas las categorías
            </button>
          </li>
          {categoryOptions.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                aria-pressed={category === c.key}
                className={cn('flex min-h-14 w-full items-center gap-3 text-left font-medium', category === c.key && 'text-brand')}
                onClick={() => (setCategory(c.key), setPage(1), setPicking(false))}
              >
                <CategoryIcon category={c.key} />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {pending > 0 && (
        <Link to="/app/transacciones" className="mt-3 block rounded-xl bg-brand-soft/60 px-3 py-2.5 text-sm text-brand">
          {pending === 1 ? '1 cambio espera' : `${pending} cambios esperan`} sincronizarse. <span className="font-medium underline">Ver</span>
        </Link>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={() => setVersion((v) => v + 1)}>
            Reintentar
          </button>
        </p>
      )}

      {result === null && !error ? (
        <p className="flex items-center gap-2 py-8 text-ink/60" aria-busy="true">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Cargando…
        </p>
      ) : result?.data.length === 0 ? (
        <p className="py-8 text-center text-ink/60">
          {filtered ? 'Ningún movimiento coincide con la búsqueda.' : `No hay movimientos en ${monthName.toLowerCase()}.`}
        </p>
      ) : (
        <div aria-busy={busy} className={cn('transition-opacity duration-150', busy && 'opacity-50')}>
          {groups.map(({ date, day, items }) => (
          <div key={date}>
            <h3 className="mb-1 mt-4 text-sm font-medium text-ink/60">{day}</h3>
            <ul className="divide-y divide-ink/10">
              {items.map((t) => (
                <MovementRow key={t.id} transaction={t} names={names} hidden={hidden} icon fresh={fresh.has(t.id)} />
              ))}
            </ul>
          </div>
          ))}
        </div>
      )}

      {result && result.data.length < result.total && (
        <Button variant="soft" className="mt-4 w-full" onClick={() => setPage((p) => p + 1)}>
          Ver más
        </Button>
      )}
    </section>
  );
}
