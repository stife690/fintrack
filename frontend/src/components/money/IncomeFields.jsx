import { CalendarDays, Shuffle } from 'lucide-react';
import { MAX_PAY_DAYS, togglePayDay } from '@/lib/moneyProfile';
import { cn } from '@/lib/utils';

const INCOME_OPTIONS = [
  { value: 'fecha_fija', icon: CalendarDays, title: 'Con fecha fija', text: 'Sueldo, quincena o mesada que llega segura' },
  { value: 'sin_fecha', icon: Shuffle, title: 'Sin fecha fija', text: 'Trabajos, ventas, ayudas o mesada que varía' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Pregunta cómo le entra la plata al usuario y, con fecha fija, qué días.
 * @param {object} props
 * @param {string} props.incomeType `''`, `fecha_fija` o `sin_fecha`.
 * @param {number[]} props.payDays
 * @param {(changes: { incomeType?: string, payDays?: number[] }) => void} props.onChange
 */
export default function IncomeFields({ incomeType, payDays, onChange }) {
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Cómo te entra la plata" className="grid gap-3">
        {INCOME_OPTIONS.map(({ value, icon: Icon, title, text }) => {
          const checked = incomeType === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange({ incomeType: value })}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
                checked ? 'border-brand bg-brand-soft' : 'border-ink/12 hover:border-ink/25',
              )}
            >
              <Icon className={cn('size-5 shrink-0', checked ? 'text-brand' : 'text-ink/60')} aria-hidden="true" />
              <span className="min-w-0">
                <span className={cn('block font-medium', checked && 'text-brand')}>{title}</span>
                <span className="block text-sm text-ink/60">{text}</span>
              </span>
            </button>
          );
        })}
      </div>

      {incomeType === 'fecha_fija' && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink/80">¿Qué días te llega? Hasta {MAX_PAY_DAYS}.</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day) => {
              const selected = payDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Día ${day}`}
                  onClick={() => onChange({ payDays: togglePayDay(payDays, day) })}
                  className={cn(
                    'grid h-10 place-items-center rounded-xl border text-sm font-medium tabular-nums transition-colors',
                    selected ? 'border-brand bg-brand-soft text-brand' : 'border-ink/12 text-ink/70 hover:border-ink/25',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-ink/60">Si eliges 31, en los meses cortos contamos el último día.</p>
        </fieldset>
      )}
    </div>
  );
}
