import { NavLink } from 'react-router-dom';
import { Briefcase, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { to: '/app/vacas', label: 'Vacas', icon: PiggyBank },
  { to: '/app/negocios', label: 'Negocios', icon: Briefcase },
];

/**
 * Selector Vacas | Negocios arriba de esas dos pantallas en el celular, donde la barra inferior
 * las junta en "Grupos". Desde tablet el menú lateral ya muestra las dos, así que se oculta.
 */
export default function GroupSwitch() {
  return (
    <nav aria-label="Grupos" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1 md:hidden">
      {OPTIONS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
