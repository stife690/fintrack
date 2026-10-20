import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto de 48px. Toma los colores del tema (oscuro fuera de /app; claro u oscuro dentro).
 * Marca el borde en rojo cuando recibe `aria-invalid`.
 * @type {React.ForwardRefExoticComponent<React.InputHTMLAttributes<HTMLInputElement>>}
 */
const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-12 w-full min-w-0 max-w-full rounded-xl border border-field-line bg-field px-4 text-base text-ink placeholder:text-ink/35 transition-colors',
      'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
