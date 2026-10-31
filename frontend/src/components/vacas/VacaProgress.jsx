import { cn } from '@/lib/utils';

/**
 * Barra de avance (meta del grupo o cuota de un miembro). Pasado el 100 % queda llena.
 * @param {object} props
 * @param {number} props.value Porcentaje (puede pasar de 100).
 * @param {string} props.label Para lectores de pantalla, p. ej. "Avance de Paseo".
 * @param {string} props.valueText Texto completo, p. ej. "$ 200.000 de $ 400.000".
 * @param {string} [props.barClass] Color de la barra.
 * @param {'sm'|'md'|'lg'} [props.size]
 */
export default function VacaProgress({ value, label, valueText, barClass = 'bg-brand', size = 'md' }) {
  const filled = Math.min(Math.max(value, 0), 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={filled}
      aria-valuetext={valueText}
      className={cn('rounded-full bg-ink/10', { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }[size])}
    >
      <div
        className={cn('h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500', barClass)}
        style={{ width: `${filled}%` }}
      />
    </div>
  );
}
