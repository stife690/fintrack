import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Variantes del botón (shadcn/ui) ajustadas a la línea gráfica de Revio. */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        dark: 'bg-obsidian text-white hover:bg-obsidian/80',
        outline: 'border border-white/15 bg-transparent text-white hover:bg-white/5',
        'outline-light': 'border border-border bg-white text-foreground hover:bg-card',
        ghost: 'text-white/60 hover:text-white',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-base',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-12 px-6 text-lg',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

/**
 * Botón base. Con `asChild` delega el render a su hijo (p. ej. un `<Link>`).
 * @type {React.ForwardRefExoticComponent<any>}
 */
const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
