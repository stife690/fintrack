import { Link } from 'react-router-dom';
import { Minus, Plus, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTIONS = [
  { to: '/app/transacciones?nuevo=gasto', label: 'Gasto', icon: Minus, tone: 'bg-negative/12 text-negative' },
  { to: '/app/transacciones?nuevo=ingreso', label: 'Ingreso', icon: Plus, tone: 'bg-positive/12 text-positive' },
  { to: '/app/presupuestos', label: 'Presupuesto', icon: Target, tone: 'bg-brand-soft text-brand' },
];

/** Accesos rápidos del inicio: registrar un gasto o un ingreso, o ir a presupuestos. */
export default function QuickActions() {
  return (
    <nav aria-label="Accesos rápidos">
      <ul className="grid grid-cols-3 gap-3">
        {ACTIONS.map(({ to, label, icon: Icon, tone }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex h-full flex-col items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-2 py-4 text-sm font-medium transition-colors hover:border-ink/20 sm:flex-row sm:justify-center sm:gap-3"
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
  );
}
