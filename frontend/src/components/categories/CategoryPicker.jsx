import { useId } from 'react';
import { Sparkles } from 'lucide-react';
import { getCategoryStyle } from '@/lib/categoryStyles';
import { cn } from '@/lib/utils';

/** Valor de la opción "que la IA la sugiera" (la API recibe `category: null`). */
export const AUTO_CATEGORY = '';

/**
 * Cuadrícula de categorías con ícono y color, en lugar de una lista desplegable.
 * Son radios nativos ocultos (flechas del teclado, lector de pantalla, envío del formulario).
 *
 * @param {object} props
 * @param {string} props.legend
 * @param {import('@/services/transactionService').Category[]} props.categories
 * @param {string} props.value Clave elegida; `AUTO_CATEGORY` para la opción de IA.
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.allowAuto] Muestra primero la opción "Sugerir con IA".
 * @param {string} [props.error] Mensaje de validación.
 * @param {boolean} [props.disabled]
 * @param {(el: HTMLInputElement|null) => void} [props.inputRef] Ref al primer radio (para enfocar al fallar la validación).
 */
export default function CategoryPicker({
  legend,
  categories,
  value,
  onChange,
  allowAuto = false,
  error,
  disabled,
  inputRef,
}) {
  const name = useId();
  const errorId = `${name}-error`;
  const options = [
    ...(allowAuto ? [{ key: AUTO_CATEGORY, name: 'Sugerir con IA', auto: true }] : []),
    ...categories,
  ];

  return (
    <fieldset disabled={disabled} aria-describedby={error ? errorId : undefined} className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-ink/80">{legend}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {options.map((c, index) => {
          const checked = value === c.key;
          const { icon: Icon, className: tone } = c.auto
            ? { icon: Sparkles, className: 'bg-brand-soft text-brand' }
            : getCategoryStyle(c.key);
          return (
            <label
              key={c.key || 'auto'}
              className={cn(
                'flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center text-xs font-medium leading-tight transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet',
                'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
                checked
                  ? 'border-brand bg-brand-soft/60 text-ink ring-1 ring-brand'
                  : error
                    ? 'border-negative/50 text-ink/75 hover:text-ink'
                    : 'border-ink/10 text-ink/75 hover:border-ink/25 hover:text-ink',
              )}
            >
              <input
                ref={index === 0 ? inputRef : undefined}
                type="radio"
                name={name}
                value={c.key}
                checked={checked}
                onChange={() => onChange(c.key)}
                className="sr-only"
              />
              <span aria-hidden="true" className={cn('grid size-9 place-items-center rounded-lg', tone)}>
                <Icon className="size-[18px]" />
              </span>
              <span className="line-clamp-2">{c.name}</span>
            </label>
          );
        })}
        {/*
          Mientras llegan las categorías (11 de gasto en el catálogo) se reserva su espacio: sin saltos
          de layout. Sin animación de carga: si la petición falla, la página ya muestra el error.
        */}
        {categories.length === 0 &&
          Array.from({ length: 11 }, (_, i) => (
            <div key={i} aria-hidden="true" className="min-h-[84px] rounded-xl bg-ink/5" />
          ))}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-sm text-negative">
          {error}
        </p>
      )}
    </fieldset>
  );
}
