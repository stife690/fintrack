import { cn } from '@/lib/utils';
import Reveal from './Reveal';

/**
 * Encabezado de sección: etiqueta tipo "pill", título y descripción.
 *
 * @param {object} props
 * @param {string} props.eyebrow Etiqueta corta sobre el título.
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {'center'|'left'} [props.align='center']
 * @param {boolean} [props.dark=false] Colores para fondo negro.
 * @param {string} [props.className]
 */
export default function SectionHeading({ eyebrow, title, description, align = 'center', dark = false, className }) {
  return (
    <Reveal
      className={cn(
        'flex max-w-2xl flex-col gap-4',
        align === 'center' ? 'mx-auto items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      <span
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium',
          dark ? 'bg-white/10 text-orchid' : 'bg-pink text-violet',
        )}
      >
        {eyebrow}
      </span>
      <h2
        className={cn(
          'text-balance text-4xl font-semibold tracking-tight md:text-5xl',
          dark ? 'text-white' : 'text-obsidian',
        )}
      >
        {title}
      </h2>
      {description && (
        <p className={cn('text-pretty text-lg', dark ? 'text-white/60' : 'text-muted-foreground')}>{description}</p>
      )}
    </Reveal>
  );
}
