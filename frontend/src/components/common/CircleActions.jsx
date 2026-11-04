import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ITEM = 'flex w-[78px] flex-col items-center gap-1.5 rounded-2xl py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-violet';

/**
 * Fila de círculos que se desliza, con las acciones de una pantalla en el celular. Cada acción es un
 * enlace (`to`) o un botón (`onClick`); la primera suele ser la principal (`primary`).
 * @param {{ label: string, actions: Array<{ label: string, icon: import('react').ElementType, to?: string, onClick?: () => void, primary?: boolean }>, className?: string }} props
 */
export default function CircleActions({ label, actions, className }) {
  return (
    <nav aria-label={label} className={cn('-mx-4', className)}>
      <ul className="flex gap-1 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
        {actions.map(({ label: text, icon: Icon, to, onClick, primary }) => {
          const circle = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-[60px] place-items-center rounded-full transition-transform duration-150 motion-safe:active:scale-95',
                  primary ? 'bg-brand text-white' : 'bg-brand-soft text-brand',
                )}
              >
                <Icon className="size-6" strokeWidth={primary ? 2.25 : 2} />
              </span>
              {text}
            </>
          );
          return (
            <li key={text} className="shrink-0">
              {to ? (
                <Link to={to} className={ITEM}>
                  {circle}
                </Link>
              ) : (
                <button type="button" onClick={onClick} className={ITEM}>
                  {circle}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
