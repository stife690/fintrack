import { useState } from 'react';
import { X } from 'lucide-react';
import { currentMonth, shiftMonth } from '@/components/budgets/month';
import ChipGroup from '@/components/common/ChipGroup';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCategoryStyle } from '@/lib/categoryStyles';
import { monthRange } from '@/services/summaryService';

/** @typedef {{ type: string, category: string, from: string, to: string }} Filters */

export const NO_FILTERS = { type: '', category: '', from: '', to: '' };

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'gasto', label: 'Gastos' },
  { value: 'ingreso', label: 'Ingresos' },
];

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo' },
  { value: 'this', label: 'Este mes' },
  { value: 'last', label: 'Mes pasado' },
  { value: 'custom', label: 'Personalizado' },
];

/** Rango de fechas de cada periodo con nombre. */
function periodRange(period) {
  if (period === 'this') return monthRange(currentMonth());
  if (period === 'last') return monthRange(shiftMonth(currentMonth(), -1));
  return { from: '', to: '' };
}

/** Qué pastilla de periodo corresponde a un rango. */
function periodOf({ from, to }) {
  if (!from && !to) return 'all';
  for (const period of ['this', 'last']) {
    const range = periodRange(period);
    if (range.from === from && range.to === to) return period;
  }
  return 'custom';
}

/**
 * Filtros del historial en forma de pastillas: tipo, periodo (con rango personalizado) y
 * categoría (en una fila deslizable, con el ícono de cada una).
 *
 * @param {object} props
 * @param {Filters} props.filters
 * @param {{ expense: import('@/services/transactionService').Category[], income: import('@/services/transactionService').Category[] }} props.categories
 * @param {(changes: Partial<Filters>) => void} props.onChange
 */
export default function TransactionFilters({ filters, categories, onChange }) {
  // "Personalizado" puede estar elegido antes de escribir las fechas.
  const [customOpen, setCustomOpen] = useState(false);
  const period = customOpen ? 'custom' : periodOf(filters);

  const pickPeriod = (next) => {
    setCustomOpen(next === 'custom');
    if (next !== 'custom') onChange(periodRange(next));
  };

  const pickType = (type) => onChange({ type, category: '' }); // la categoría era del otro tipo

  const list =
    filters.type === 'gasto'
      ? categories.expense
      : filters.type === 'ingreso'
        ? categories.income
        : [...categories.expense, ...categories.income];
  const categoryOptions = [
    { value: '', label: 'Todas' },
    ...list.map((c) => ({ value: c.key, label: c.name, icon: getCategoryStyle(c.key).icon })),
  ];

  const active = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <ChipGroup legend="Tipo" options={TYPE_OPTIONS} value={filters.type} onChange={pickType} />
        <ChipGroup legend="Periodo" options={PERIOD_OPTIONS} value={period} onChange={pickPeriod} />
      </div>

      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="f-from">Desde</Label>
            <Input
              id="f-from"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => onChange({ from: e.target.value })}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="f-to">Hasta</Label>
            <Input
              id="f-to"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          </div>
        </div>
      )}

      <ChipGroup
        legend="Categoría"
        options={categoryOptions}
        value={filters.category}
        onChange={(category) => onChange({ category })}
        scroll
      />

      {active && (
        <button
          type="button"
          onClick={() => {
            setCustomOpen(false);
            onChange(NO_FILTERS);
          }}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <X className="size-4" aria-hidden="true" />
          Quitar filtros
        </button>
      )}
    </div>
  );
}
