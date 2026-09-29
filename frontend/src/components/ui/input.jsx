import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto oscuro de 48px, como los formularios de auth de la plantilla.
 * Marca el borde en rojo cuando recibe `aria-invalid`.
 * @type {React.ForwardRefExoticComponent<React.InputHTMLAttributes<HTMLInputElement>>}
 */
const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-12 w-full rounded-xl border border-input bg-black px-4 text-base text-white placeholder:text-white/35 transition-colors',
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
