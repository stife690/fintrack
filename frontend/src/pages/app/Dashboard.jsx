import { Link } from 'react-router-dom';
import { ArrowLeftRight, ChevronRight, Target } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/auth/AuthContext';
import usePageTitle from '@/hooks/usePageTitle';
import { getDisplayName } from '@/lib/displayName';

const SHORTCUTS = [
  {
    to: '/app/transacciones',
    icon: ArrowLeftRight,
    title: 'Movimientos',
    text: 'Registra un gasto o un ingreso y revisa tu historial.',
  },
  {
    to: '/app/presupuestos',
    icon: Target,
    title: 'Presupuestos',
    text: 'Pon un límite por categoría y mira cuánto llevas.',
  },
];

/**
 * Página privada `/app`. Por ahora saluda y lleva a cada sección; el resumen del mes
 * (saldo, alertas y últimos movimientos) llega en la siguiente fase del rediseño.
 */
export default function Dashboard() {
  usePageTitle('Inicio');
  const { user } = useAuth();
  const name = getDisplayName(user);

  return (
    <>
      <PageHeader title={name ? `Hola, ${name}` : 'Hola'} description="¿Qué quieres hacer hoy?" />
      <ul className="grid gap-4 sm:grid-cols-2">
        {SHORTCUTS.map(({ to, icon: Icon, title, text }) => (
          <li key={to}>
            <Link
              to={to}
              className="group flex h-full items-center gap-4 rounded-2xl border border-ink/10 bg-surface p-5 transition-colors hover:border-brand/40"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-ink/60">{text}</span>
              </span>
              <ChevronRight
                className="size-5 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
