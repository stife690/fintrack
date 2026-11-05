import { cn } from '@/lib/utils';

/** Borde inferior dentado de la tirilla (como el corte del papel térmico). */
const TEETH = 18;
const ZIGZAG = (() => {
  const step = 100 / TEETH;
  const points = ['0% 0%', '100% 0%', '100% calc(100% - 10px)'];
  for (let i = TEETH; i > 0; i -= 1) {
    points.push(`${(i - 0.5) * step}% 100%`, `${(i - 1) * step}% calc(100% - 10px)`);
  }
  return `polygon(${points.join(',')})`;
})();

/**
 * Papel de la tirilla: fondo de papel térmico, tinta obsidiana y corte dentado abajo.
 * Es la pieza gráfica propia de la landing (hero, seguridad y llamado final).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function ReceiptPaper({ children, className }) {
  return (
    <div className={cn('bg-paper px-5 pb-8 pt-5 text-left text-obsidian sm:px-6', className)} style={{ clipPath: ZIGZAG }}>
      {children}
    </div>
  );
}

/**
 * Renglón de la tirilla: concepto a la izquierda y valor a la derecha, con cifras tabulares.
 *
 * @param {object} props
 * @param {React.ReactNode} props.label
 * @param {React.ReactNode} [props.detail] Texto pequeño bajo el concepto (categoría, origen).
 * @param {React.ReactNode} props.value
 * @param {boolean} [props.strong] Renglón de total.
 * @param {string} [props.className]
 */
export function ReceiptRow({ label, detail, value, strong = false, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <div className="min-w-0">
        <p className={cn(strong ? 'text-sm font-bold uppercase leading-tight tracking-wide' : 'truncate text-[15px]')}>{label}</p>
        {detail && <p className="text-xs text-obsidian/60">{detail}</p>}
      </div>
      <p className={cn('shrink-0 tabular-nums', strong ? 'text-2xl font-bold tracking-tight' : 'text-[15px] font-medium')}>
        {value}
      </p>
    </div>
  );
}

/**
 * Sello de tinta violeta, ligeramente girado, como el "pagado" de una caja.
 * @param {{ children: React.ReactNode, className?: string }} props
 */
export function ReceiptStamp({ children, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none grid size-[5.5rem] -rotate-12 place-items-center rounded-full border-[3px] border-violet text-center text-[11px] font-bold uppercase leading-tight tracking-wide text-violet',
        className,
      )}
    >
      {children}
    </span>
  );
}
