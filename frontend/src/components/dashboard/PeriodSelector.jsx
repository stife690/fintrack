import { ChevronLeft, ChevronRight } from 'lucide-react';
import ChipGroup from '@/components/common/ChipGroup';
import PeriodJumpPicker from '@/components/dashboard/PeriodJumpPicker';
import { PERIOD_OPTIONS, isCurrentPeriod, periodLabel, shiftPeriod, todayIso } from '@/lib/period';
import { cn } from '@/lib/utils';

/**
 * Botón redondo de flecha para ir al periodo anterior o al siguiente.
 * @param {{ label: string, onClick: () => void, disabled?: boolean, children: import('react').ReactNode }} props
 */
function ArrowButton({ label, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'grid size-9 place-items-center rounded-full border border-ink/12 bg-surface text-ink/70 transition-colors',
        'hover:border-ink/25 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Selector de periodo del dashboard (FT-0004): semana, mes o año, y flechas para moverse
 * al periodo anterior o siguiente. Tocar el nombre del periodo abre un panel para saltar directo
 * a otro (p. ej. de septiembre a enero). No deja ir más allá del periodo actual.
 *
 * Es un componente "controlado": no guarda nada propio, recibe `period` y `date` del padre
 * y le avisa con `onChange` cuando el usuario cambia algo.
 *
 * @param {object} props
 * @param {'week'|'month'|'year'} props.period
 * @param {string} props.date Un día del periodo elegido, AAAA-MM-DD.
 * @param {(next: { period: 'week'|'month'|'year', date: string }) => void} props.onChange
 * @param {string} [props.className]
 */
export default function PeriodSelector({ period, date, onChange, className }) {
  const label = periodLabel(period, date);
  const atCurrent = isCurrentPeriod(period, date);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <ChipGroup
        legend="Periodo del resumen"
        hideLegend
        options={PERIOD_OPTIONS}
        value={period}
        // Al cambiar de tipo de periodo se vuelve a hoy: "Mes" muestra el mes actual.
        onChange={(next) => onChange({ period: next, date: todayIso() })}
      />

      <div className="flex items-center gap-2">
        <ArrowButton label="Periodo anterior" onClick={() => onChange({ period, date: shiftPeriod(period, date, -1) })}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </ArrowButton>
        <PeriodJumpPicker period={period} date={date} label={label} onPick={(next) => onChange({ period, date: next })} />
        <ArrowButton
          label="Periodo siguiente"
          disabled={atCurrent}
          onClick={() => onChange({ period, date: shiftPeriod(period, date, 1) })}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </ArrowButton>
      </div>
    </div>
  );
}
