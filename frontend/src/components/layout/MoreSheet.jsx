import { Link } from 'react-router-dom';
import {
  Briefcase,
  ChevronRight,
  CircleUserRound,
  Crown,
  Download,
  Landmark,
  Lightbulb,
  PiggyBank,
  Plus,
  Target,
  UserPlus,
} from 'lucide-react';
import Sheet from '@/components/common/Sheet';

/** Lo que no está en la barra del celular. Solo van secciones que ya funcionan. */
export const MORE_GROUPS = [
  {
    label: 'Mi dinero',
    items: [
      { to: '/app/transacciones?nuevo=gasto', label: 'Agregar movimiento', detail: 'Abre el formulario', icon: Plus },
      { to: '/app/presupuestos', label: 'Presupuestos', detail: 'Límites por categoría', icon: Target },
      { to: '/app/renta', label: 'Renta y DIAN', detail: 'Si debes declarar y cuándo', icon: Landmark },
      { to: '/app/transacciones/exportar', label: 'Exportar reportes', detail: 'Excel, PDF o CSV', icon: Download },
    ],
  },
  {
    label: 'En grupo',
    items: [
      { to: '/app/vacas', label: 'Vacas', detail: 'Ahorren juntos para una meta', icon: PiggyBank },
      { to: '/app/negocios', label: 'Negocios', detail: 'Cuentas con tus socios', icon: Briefcase },
    ],
  },
  {
    label: 'FinTrack',
    items: [
      { to: '/app/invitar', label: 'Invitar amigos', detail: 'Compárteles la app', icon: UserPlus },
      { to: '/app/planes', label: 'Planes', detail: 'Beta: aún no se cobra', icon: Crown },
      { to: '/app/lo-que-viene', label: 'Lo que viene', detail: 'Vota y pide funciones', icon: Lightbulb },
    ],
  },
  {
    label: 'Mi cuenta',
    items: [{ to: '/app/cuenta', label: 'Cuenta', detail: 'Perfil, categorías y tema', icon: CircleUserRound }],
  },
];

/**
 * ¿La ruta es de una sección de "Más"? Así el botón se marca como activo.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isMorePath(pathname) {
  return MORE_GROUPS.some(({ items }) =>
    items.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`)),
  );
}

/** Menú del botón flotante del celular: el resto de las secciones, por grupos. */
export default function MoreSheet({ open, onClose }) {
  return (
    <Sheet open={open} title="Más" onClose={onClose}>
      <div className="space-y-5">
        {MORE_GROUPS.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="mb-1 text-sm text-ink/60">{group.label}</h3>
            <ul className="divide-y divide-ink/10">
              {group.items.map(({ to, label, detail, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={onClose}
                    className="flex min-h-14 items-center gap-3 rounded-xl py-2 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{label}</span>
                      <span className="block truncate text-xs text-ink/60">{detail}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink/40" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
