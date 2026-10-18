import { getCategoryStyle } from '@/lib/categoryStyles';
import { cn } from '@/lib/utils';

/**
 * Cuadro redondeado con el ícono y el color de una categoría. Es decorativo: el nombre de la
 * categoría siempre va en texto al lado.
 * @param {{ category: string|null|undefined, className?: string }} props
 */
export default function CategoryIcon({ category, className }) {
  const { icon: Icon, className: colors } = getCategoryStyle(category);
  return (
    <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl', colors, className)}>
      <Icon className="size-5" />
    </span>
  );
}
