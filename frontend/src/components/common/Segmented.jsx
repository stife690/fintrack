import { cn } from '@/lib/utils';

/**
 * Control de opciones excluyentes, en una sola franja (Gasto | Ingreso, Semana | Mes | Año).
 * @param {{ label: string, options: Array<{ value: string, label: string }>, value: string, onChange: (value: string) => void, className?: string }} props
 */
export default function Segmented({ label, options, value, onChange, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-1 rounded-xl bg-ink/5 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-11 rounded-[9px] text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
            value === option.value ? 'bg-surface text-ink shadow-sm' : 'text-ink/70',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
