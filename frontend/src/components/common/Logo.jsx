import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Isotipo de FinTrack: tres barras ascendentes sobre un cuadro violeta.
 * @param {{ className?: string }} props
 */
export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8', className)}>
      <defs>
        <linearGradient id="fintrack-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6142ff" />
          <stop offset="1" stopColor="#8b66ff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#fintrack-mark)" />
      <rect x="8" y="17" width="4" height="7" rx="1.5" fill="#fff" opacity=".55" />
      <rect x="14" y="12" width="4" height="12" rx="1.5" fill="#fff" opacity=".8" />
      <rect x="20" y="7" width="4" height="17" rx="1.5" fill="#fff" />
    </svg>
  );
}

/**
 * Logo completo (isotipo + nombre) enlazado al inicio.
 * @param {{ className?: string, dark?: boolean }} props `dark` pinta el texto negro (fondos claros).
 */
export default function Logo({ className, dark = false }) {
  return (
    <Link
      to="/"
      aria-label="FinTrack, ir al inicio"
      className={cn(
        'inline-flex items-center gap-2 text-2xl font-semibold tracking-tight',
        dark ? 'text-obsidian' : 'text-white',
        className,
      )}
    >
      <LogoMark />
      FinTrack
    </Link>
  );
}
