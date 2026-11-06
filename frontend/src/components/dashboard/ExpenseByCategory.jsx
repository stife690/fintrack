import { formatMoney } from '@/components/transactions/format';

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

return (
    <section aria-labelledby="by-category-title" className={className}>
      <h2 id="by-category-title" className="text-lg font-semibold tracking-tight">
        En qué se fue
      </h2>
      <div className="mt-2 rounded-2xl border border-ink/10 bg-surface p-3.5">
        {expense === undefined ? (
          <div className="h-24 animate-pulse rounded-xl bg-ink/5" aria-busy="true" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink/60">No hay gastos en este periodo.</p>
        ) : (
          <ul className="space-y-3.5">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="min-w-0 truncate font-medium">{r.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{hidden ? MASK : formatMoney(r.total)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-ink/10" aria-hidden="true">
                  <div className="h-full origin-left rounded-full bg-brand motion-safe:animate-bar-in" style={{ width: `${Math.max(r.percentage, 2)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
