import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Crown, Download, Lightbulb, Loader2, LogOut, UserPlus, Wallet } from 'lucide-react';
import CustomCategories from '@/components/account/CustomCategories';
import DeleteAccount from '@/components/account/DeleteAccount';
import ProfileCard from '@/components/account/ProfileCard';
import ThemeSelector from '@/components/account/ThemeSelector';
import WhatsappLink from '@/components/account/WhatsappLink';
import NotificationBell from '@/components/layout/NotificationBell';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import usePageTitle from '@/hooks/usePageTitle';

/** Lo que se abre desde Cuenta porque no se usa todos los días. */
export const LINKS = [
  { to: '/app/transacciones/exportar', label: 'Exportar reportes', detail: 'Excel, PDF o CSV', icon: Download },
  { to: '/app/invitar', label: 'Invitar amigos', detail: 'Compárteles la app', icon: UserPlus },
  { to: '/app/planes', label: 'Planes', detail: 'Beta: aún no se cobra', icon: Crown },
  { to: '/app/lo-que-viene', label: 'Lo que viene', detail: 'Vota y pide funciones', icon: Lightbulb },
];

/** Bloque con título de una sección de ajustes. */
function Section({ id, title, description, children }) {
  return (
    <Panel aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

/** Grupo de ajustes con su nombre, para ubicar rápido lo que se busca. */
function Group({ label, children }) {
  return (
    <section aria-label={label}>
      <p aria-hidden="true" className="mb-2 px-1 text-sm font-medium text-ink/60">
        {label}
      </p>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

/**
 * Página privada `/app/cuenta`, por grupos: perfil (nombre editable), acceso a Mi plata, preferencias
 * (tema de la app y categorías propias), alertas (REQ-029 y REQ-030), cierre de sesión y eliminar la
 * cuenta (FT-0017).
 */
export default function Account() {
  usePageTitle('Cuenta');
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const handleSignOut = async () => {
    setLeaving(true);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Cuenta" />

      <div className="flex flex-col gap-8">
        <ProfileCard />
        {/* Desde tablet la campana está en el menú lateral. */}
        <Panel className="p-1 md:hidden">
          <NotificationBell label className="w-full pr-3" />
        </Panel>
        <Panel className="p-0 md:p-0">
          <Link
            to="/app/mi-plata"
            className="flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
          >
            <Wallet className="size-5 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Mi plata</span>
              <span className="block text-sm text-ink/60">Cómo recibes la plata y qué pagas cada mes</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
          </Link>
        </Panel>

        {/* Desde tablet están en el menú lateral, y Exportar en Movimientos. */}
        <div className="md:hidden">
          <Group label="Más">
            <Panel className="divide-y divide-ink/10 p-0">
              {LINKS.map(({ to, label, detail, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 p-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
                >
                  <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-sm text-ink/60">{detail}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
                </Link>
              ))}
            </Panel>
          </Group>
        </div>

        <Group label="Preferencias">
          <Section id="apariencia" title="Apariencia" description="Elige cómo se ve FinTrack.">
            <ThemeSelector />
          </Section>
          <CustomCategories />
          <WhatsappLink />
        </Group>

        <Group label="Alertas">
          <NotificationSettings />
        </Group>

        <Group label="Sesión">
          <Panel className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Cerrar sesión</h2>
              <p className="mt-1 text-sm text-ink/60">Sales de tu cuenta en este dispositivo.</p>
            </div>
            <Button variant="outline" onClick={handleSignOut} disabled={leaving}>
              {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
              {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Button>
          </Panel>
          <DeleteAccount />
        </Group>
      </div>
    </div>
  );
}
