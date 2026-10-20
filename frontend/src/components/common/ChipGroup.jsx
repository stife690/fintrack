import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * @typedef {object} ChipOption
 * @property {string} value
 * @property {string} label
 * @property {import('lucide-react').LucideIcon} [icon]
 * @property {boolean} [disabled] Se ve pero no se puede elegir (p. ej. una función que aún no existe).
 * @property {string} [badge] Texto pequeño al lado de la etiqueta, p. ej. "Próximamente".
 */

/**
 * Grupo de opciones en forma de "pastillas" (una sola elegida). Son radios nativos ocultos:
 * se navegan con las flechas del teclado y el lector de pantalla anuncia el grupo y la opción.
 *
 * @param {object} props
 * @param {string} props.legend Nombre del grupo (visible o solo para lectores con `hideLegend`).
 * @param {boolean} [props.hideLegend]
 * @param {ChipOption[]} props.options
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.scroll] Una sola fila con desplazamiento horizontal (muchas opciones en celular).
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export default function ChipGroup({ legend, hideLegend = false, options, value, onChange, scroll = false, disabled, className }) {
  const name = useId();
  return (
    <fieldset className={cn('min-w-0', className)} disabled={disabled}>
      <legend className={cn('mb-2 text-sm font-medium text-ink/80', hideLegend && 'sr-only')}>{legend}</legend>
      <div
        className={cn(
          'flex gap-2',
          scroll
            ? '-mx-1 snap-x overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'flex-wrap',
        )}
      >
        {options.map(({ value: optionValue, label, icon: Icon, disabled: optionDisabled, badge }) => {
          const checked = value === optionValue;
          return (
            <label
              key={optionValue}
              className={cn(
                // `relative`: el radio oculto (sr-only) es `absolute`; sin esto su caja de referencia es la página
                // y, en la fila deslizable, se salía a la derecha y ensanchaba el documento (zoom-out en celular).
                'relative inline-flex h-9 shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet',
                'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
                checked
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-ink/12 bg-surface text-ink/70 hover:border-ink/25 hover:text-ink',
              )}
            >
              <input
                type="radio"
                name={name}
                value={optionValue}
                checked={checked}
                disabled={optionDisabled}
                onChange={() => onChange(optionValue)}
                className="sr-only"
              />
              {Icon && <Icon className="size-4" aria-hidden="true" />}
              {label}
              {badge && <span className="text-xs font-normal text-ink/50">· {badge}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
