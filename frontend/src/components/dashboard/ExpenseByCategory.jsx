import { formatMoney } from '@/components/transactions/format';
import { cn } from '@/lib/utils';

/** Cuántas categorías se muestran; el resto se suma en "Otras categorías". */
const MAX_ROWS = 5;
const MASK = '$ ••••••';

/**
 * Junta las categorías más pequeñas en una sola fila para que la lista no crezca sin control.
 * @param {Array<{ category: string|null, total: number, percentage: number }>} rows Ordenadas de mayor a menor.
 * @param {Record<string, string>} names Clave → nombre legible.
 * @returns {Array<{ key: string, name: string, total: number, percentage: number }>}
 */
function toRows(rows, names) {
  const named = rows.map((r) => ({
    key: r.category ?? 'sin_clasificar',
    name: r.category ? (names[r.category] ?? r.category) : 'Sin clasificar',
    total: r.total,
    percentage: r.percentage,
  }));
  if (named.length <= MAX_ROWS + 1) return named;
  const rest = named.slice(MAX_ROWS);
  return [
    ...named.slice(0, MAX_ROWS),
    {
      key: 'otras',
      name: `Otras ${rest.length} categorías`,
      total: Math.round(rest.reduce((a, r) => a + r.total, 0) * 100) / 100,
      percentage: Math.round(rest.reduce((a, r) => a + r.percentage, 0) * 10) / 10,
    },
  ];
}

/**
 * Gastos del periodo por categoría (FT-0004), de mayor a menor, como barras horizontales.
 * Cada fila dice su monto y su porcentaje con texto, así el color nunca es la única pista.
 *
 * @param {object} props
 * @param {{ total: number, byCategory: Array<{ category: string|null, total: number, percentage: number }> }|undefined} props.expense
 *   `undefined` mientras carga.
 * @param {Record<string, string>} props.names
 * @param {boolean} props.hidden Ocultar montos (el ojo de la tarjeta de balance).
 * @param {string} [props.className]
 */
export default function ExpenseByCategory({ expense, names, hidden, className }) {
  const rows = expense ? toRows(expense.byCategory, names) : [];
  // La barra más larga ocupa todo el ancho; las demás, en proporción a ella.
  const max = rows.length ? Math.max(...rows.map((r) => r.total)) : 0;

  return (
    <section
      aria-labelledby="by-category-title"
      className={cn('rounded-3xl border border-ink/10 bg-surface p-5 md:p-6', className)}
    >
      <h2 id="by-category-title" className="text-base font-semibold">
        ¿En qué se fue la plata?
      </h2>
      <p className="mt-0.5 text-sm text-ink/60">Gastos por categoría</p>

      {expense === undefined && (
        <ul className="mt-5 space-y-4" aria-hidden="true">
          {[80, 55, 35].map((w) => (
            <li key={w}>
              <span className="block h-3 w-28 animate-pulse rounded bg-ink/10" />
              <span className="mt-2 block h-2 animate-pulse rounded-full bg-ink/10" style={{ width: `${w}%` }} />
            </li>
          ))}
        </ul>
      )}

      {expense && rows.length === 0 && <p className="mt-5 text-sm text-ink/60">No hay gastos en este periodo.</p>}

      {rows.length > 0 && (
        <ul className="mt-5 space-y-4">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{r.name}</span>
                <span className="shrink-0 tabular-nums text-ink/70">
                  {hidden ? MASK : formatMoney(r.total)}
                  <span className="ml-2 inline-block w-12 text-right text-ink/50">{r.percentage}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-ink/6" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${max === 0 ? 0 : Math.max((r.total / max) * 100, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
