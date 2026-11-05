import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Degradados del cuadro: el de la marca y uno más claro para fondos violeta. */
const GRADIENTS = { brand: ['#6142ff', '#8b66ff'], light: ['#a58bff', '#c9b8ff'] };

/**
 * Isotipo de FinTrack: tres barras ascendentes sobre un cuadro violeta.
 * El id del degradado es único por instancia: si dos logos compartieran id y el primero
 * estuviera oculto (display: none), el segundo se quedaría sin el cuadro violeta.
 * `tone="light"` aclara el degradado para que el logo resalte sobre un fondo violeta.
 * @param {{ className?: string, tone?: 'brand' | 'light' }} props
 */
export function LogoMark({ className, tone = 'brand' }) {
  const [from, to] = GRADIENTS[tone] ?? GRADIENTS.brand;
  // useId da ids como ':r1:'; sin los dos puntos son seguros dentro de url(#…).
  const gradientId = `fintrack-mark${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8', className)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
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
