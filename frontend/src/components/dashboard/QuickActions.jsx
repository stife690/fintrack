import { Link } from 'react-router-dom';
import { CreditCard, HandCoins, Minus, Plus, Sparkles, Target, Users } from 'lucide-react';
import CircleActions from '@/components/common/CircleActions';
import { cn } from '@/lib/utils';

const ACTIONS = [
  { to: '/app/transacciones?nuevo=gasto', label: 'Gasto', icon: Minus, tone: 'bg-negative/12 text-negative' },
  { to: '/app/transacciones?nuevo=ingreso', label: 'Ingreso', icon: Plus, tone: 'bg-positive/12 text-positive' },
  { to: '/app/presupuestos', label: 'Presupuesto', icon: Target, tone: 'bg-brand-soft text-brand' },
];

/** Círculos del celular: desde aquí se llega a cada sección, ya que no hay menú. Los movimientos, con "Ver todos". */
export const CIRCLES = [
  { to: '/app/anotar', label: 'Anotar', icon: Plus, primary: true },
  { to: '/app/presupuestos', label: 'Presupuestos', icon: Target },
  { to: '/app/insights', label: 'Consejos', icon: Sparkles },
  { to: '/app/tarjetas', label: 'Tarjetas', icon: CreditCard },
  { to: '/app/cuentas', label: 'Cuentas', icon: HandCoins },
  { to: '/app/vacas', label: 'En grupo', icon: Users },
];

/**
 * Accesos del inicio. En el celular, una fila de círculos que se desliza; desde tablet, que ya tiene
 * el menú lateral, los accesos para registrar un gasto o un ingreso o ir a presupuestos.
 */
export default function QuickActions() {
  return (
    <>
      <CircleActions label="Accesos" actions={CIRCLES} className="md:hidden" />

      <nav aria-label="Accesos rápidos" className="hidden md:block">
        <ul className="grid grid-cols-3 gap-3">
          {ACTIONS.map(({ to, label, icon: Icon, tone }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-full flex-row items-center justify-center gap-3 rounded-2xl border border-ink/10 bg-surface px-2 py-4 text-sm font-medium transition-colors hover:border-ink/20"
              >
                <span aria-hidden="true" className={cn('grid size-9 place-items-center rounded-full', tone)}>
                  <Icon className="size-[18px]" strokeWidth={2.25} />
                </span>
                <span>
                  <span className="sr-only">Registrar </span>
                  {label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
