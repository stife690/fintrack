import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ITEM =
  'flex flex-col items-center gap-1.5 rounded-2xl py-1 text-center font-medium focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-40';

/**
 * Fila de círculos que se desliza, con las acciones de una pantalla en el celular. Cada acción es un
 * enlace (`to`) o un botón (`onClick`, que puede estar `disabled`); la primera suele ser la principal (`primary`).
 * @param {{ label: string, actions: Array<{ label: string, icon: import('react').ElementType, to?: string, onClick?: () => void, disabled?: boolean, primary?: boolean }>, className?: string }} props
 */
export default function CircleActions({ label, actions, className }) {
  const itemClass = cn(ITEM, actions.length <= 4 ? 'w-[88px] text-[13px]' : 'w-[78px] text-xs');
  return (
    <nav aria-label={label} className={cn('-mx-4', className)}>
      <ul className="flex gap-1 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
        {actions.map(({ label: text, icon: Icon, to, onClick, disabled, primary }) => {
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
                <Link to={to} className={itemClass}>
                  {circle}
                </Link>
              ) : (
                <button type="button" onClick={onClick} disabled={disabled} className={itemClass}>
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
