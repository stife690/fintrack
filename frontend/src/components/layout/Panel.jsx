import { cn } from '@/lib/utils';

/**
 * Tarjeta base de la zona privada: fondo de superficie, borde suave y esquinas amplias.
 * @param {{ as?: React.ElementType, className?: string, children: React.ReactNode } & Record<string, any>} props
 */
export default function Panel({ as: Component = 'section', className, children, ...props }) {
  return (
    <Component
      className={cn('min-w-0 rounded-2xl border border-ink/10 bg-surface p-5 md:p-6', className)}
      {...props}
    >
      {children}
    </Component>
  );
}
