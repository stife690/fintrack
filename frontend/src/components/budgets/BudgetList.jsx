import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/components/transactions/format';
import { cn } from '@/lib/utils';

/** Umbral de advertencia (RN-04): se dibuja como una marca fija sobre cada barra. */
const WARNING_AT = 80;

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * @param {number} value
 * @returns {string} Porcentaje con coma decimal, p. ej. `106,25 %`.
 */
function formatPercent(value) {
  return `${percent.format(value)} %`;
}

/** Color de la barra y del texto de estado según el nivel de alerta. */
const LEVEL_STYLES = {
  none: { bar: 'bg-success', text: 'text-success' },
  warning_80: { bar: 'bg-amber-400', text: 'text-amber-300' },
  exceeded_100: { bar: 'bg-destructive', text: 'text-destructive' },
};

/**
 * Frase de estado del presupuesto, en términos de dinero y no de porcentaje.
 * @param {import('@/services/budgetService').Budget} budget
 * @returns {string}
 */
function statusText({ amount, consumed, alert }) {
  if (alert.level === 'exceeded_100') {
    return consumed === amount
      ? 'Llegaste al límite'
      : `Te pasaste por ${formatMoney(consumed - amount)}`;
  }
  const left = `Quedan ${formatMoney(amount - consumed)}`;
  return alert.level === 'warning_80' ? `${left}, cerca del límite` : left;
}

/**
 * Barra de consumo con la marca del 80 %. Pasado el 100 % la barra queda llena y en rojo.
 * @param {object} props
 * @param {import('@/services/budgetService').Budget} props.budget
 * @param {string} props.label Nombre de la categoría, para lectores de pantalla.
 */
function Meter({ budget, label }) {
  const filled = Math.min(budget.percentage, 100);
  return (
    <div
      role="meter"
      aria-label={`Consumo de ${label}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={filled}
      aria-valuetext={`${formatPercent(budget.percentage)} de ${formatMoney(budget.amount)}`}
      className="relative h-2.5 rounded-full bg-white/10"
    >
      <div
        className={cn(
          'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500',
          LEVEL_STYLES[budget.alert.level].bar,
        )}
        style={{ width: `${filled}%` }}
      />
      <span
        aria-hidden="true"
        className="absolute -top-1 h-[calc(100%+0.5rem)] w-0.5 rounded-full bg-white/60"
        style={{ left: `${WARNING_AT}%` }}
      />
    </div>
  );
}

/**
 * Fila de un presupuesto: categoría, gastado contra límite, barra y acciones.
 * @param {object} props
 * @param {import('@/services/budgetService').Budget} props.budget
 * @param {string} props.name Nombre legible de la categoría.
 * @param {boolean} props.disabled
 * @param {(b: import('@/services/budgetService').Budget) => void} props.onEdit
 * @param {(b: import('@/services/budgetService').Budget) => Promise<void>} props.onDelete
 */
function Row({ budget, name, disabled, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete(budget);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-white">{name}</p>
        <p className="tabular-nums text-white/60">
          <span className="text-lg font-semibold text-white">{formatMoney(budget.consumed)}</span>{' '}
          de {formatMoney(budget.amount)}
        </p>
      </div>

      <div className="mt-3">
        <Meter budget={budget} label={name} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-sm', LEVEL_STYLES[budget.alert.level].text)}>
          <span className="font-semibold tabular-nums">{formatPercent(budget.percentage)}</span>{' '}
          <span className="text-white/60">{statusText(budget)}</span>
        </p>

        <div className="flex items-center gap-1">
          {confirming ? (
            <>
              <span className="mr-1 text-sm text-white/60">¿Eliminar?</span>
              <Button size="sm" variant="outline" onClick={remove} disabled={busy}>
                Sí, eliminar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                No
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEdit(budget)}
                disabled={disabled}
                aria-label={`Cambiar el límite de ${name}`}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setConfirming(true)}
                disabled={disabled}
                aria-label={`Eliminar el presupuesto de ${name}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Lista de presupuestos del mes, cada uno con su barra de consumo.
 * @param {object} props
 * @param {import('@/services/budgetService').Budget[]} props.budgets
 * @param {Record<string, string>} props.categoryNames Nombre legible por clave de categoría.
 * @param {boolean} [props.disabled] Desactiva editar y eliminar (p. ej. sin conexión).
 * @param {(b: import('@/services/budgetService').Budget) => void} props.onEdit
 * @param {(b: import('@/services/budgetService').Budget) => Promise<void>} props.onDelete
 */
export default function BudgetList({ budgets, categoryNames, disabled = false, onEdit, onDelete }) {
  return (
    <ul className="divide-y divide-white/10">
      {budgets.map((b) => (
        <Row
          key={b.id}
          budget={b}
          name={categoryNames[b.category] ?? b.category}
          disabled={disabled}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
