import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lista desplegable nativa con el mismo aspecto que `Input` (48 px, fondo oscuro).
 * Usa el `<select>` del navegador para que funcione bien en móvil y con teclado.
 * @type {React.ForwardRefExoticComponent<React.SelectHTMLAttributes<HTMLSelectElement>>}
 */
const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-12 w-full rounded-xl border border-input bg-black px-4 text-base text-white transition-colors',
      'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export { Select };
