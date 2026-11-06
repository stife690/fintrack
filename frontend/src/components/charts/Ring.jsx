import { cn } from '@/lib/utils';

const RADIUS = 42;
/** Separación entre partes, en la misma unidad de `value` (de 0 a 100): el fondo se ve entre ellas. */
const GAP = 0.8;
const MIN_ARC = 0.6;

/**
 * Anillo en SVG, sin librería de gráficos para que el inicio cargue rápido también con mala señal.
 * Los colores vienen del tema; el dato siempre se repite en texto, así que el dibujo es decorativo.
 * @param {object} props
 * @param {Array<{ key: string, value: number, title?: string, className?: string, color?: string }>} props.segments
 *   Partes en orden; `value` de 0 a 100.
 * @param {number} [props.strokeWidth] Grosor, sobre un lienzo de 100.
 * @param {string} [props.className] Debe dar el tamaño.
 * @param {React.ReactNode} [props.children] Lo que va en el centro.
 */
export default function Ring({ segments, strokeWidth = 11, className, children }) {
  const gap = segments.length > 1 ? GAP : 0;
  let start = 0;
  return (
    <div className={cn('relative shrink-0', className)}>
      <svg viewBox="0 0 100 100" className="block size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth={strokeWidth} className="stroke-ink/10" />
        {segments.map(({ key, value, title, className: tone, color }) => {
          const arc = Math.max(value - gap, value > 0 ? MIN_ARC : 0);
          const offset = -start;
          start += value;
          return (
            <circle
              key={key}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              pathLength="100"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc} ${100 - arc}`}
              strokeDashoffset={offset}
              className={cn('motion-safe:animate-ring-in motion-safe:transition-[stroke-dasharray,stroke-dashoffset] motion-safe:duration-500', tone)}
              style={color ? { stroke: color } : undefined}
            >
              {title && <title>{title}</title>}
            </circle>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}
