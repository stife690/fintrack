import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import MovementRow from '@/components/transactions/MovementRow';
import { SEARCH_DELAY_MS } from '@/components/transactions/TransactionFilters';
import { formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { SYNC_EVENT, listCached } from '@/offline/sync';
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

/**
 * Movimientos dentro de Mi plata, en el celular: buscador y la lista por día. Sin conexión muestra
 * la copia guardada en el dispositivo. Los filtros por tipo, categoría y fechas siguen en Movimientos.
 * @param {{ names: Record<string, string> }} props
 */
export default function MovementList({ names }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [pages, setPages] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => (setQ(text.trim()), setPages(1)), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    const reload = () => setVersion((v) => v + 1);
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
    const query = { q, page: 1, pageSize: PAGE_SIZE * pages };
    listTransactions(query)
      .catch(async (err) => {
        if (err.code !== 'NETWORK_ERROR') throw err;
        const cached = await listCached(query).catch(() => null);
        if (!cached) throw err;
        return cached;
      })
      .then((res) => !cancelled && (setResult(res), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [q, pages, version]);

  const groups = useMemo(() => groupByDay(result?.data ?? []), [result]);

  return (
    <section id="movimientos" aria-labelledby="movimientos-title" className="scroll-mt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="movimientos-title" className="text-lg font-semibold tracking-tight">
          Movimientos
        </h2>
        <Link to="/app/mes" className="-my-3 py-3 text-sm font-medium text-brand">
          Cómo va el mes
        </Link>
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
          {q ? 'Ningún movimiento coincide con la búsqueda.' : 'Aún no tienes movimientos.'}
        </p>
      ) : (
        groups.map(({ date, day, items }) => (
          <div key={date}>
            <h3 className="mb-1 mt-4 text-sm font-medium text-ink/60">{day}</h3>
            <ul className="divide-y divide-ink/10">
              {items.map((t) => (
                <MovementRow key={t.id} transaction={t} names={names} />
              ))}
            </ul>
          </div>
        ))
      )}

      {result && result.data.length < result.total && (
        <Button variant="soft" className="mt-4 w-full" onClick={() => setPages((p) => p + 1)}>
          Ver más
        </Button>
      )}
    </section>
  );
}
