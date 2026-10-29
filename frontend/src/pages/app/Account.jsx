import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import CustomCategories from '@/components/account/CustomCategories';
import ProfileCard from '@/components/account/ProfileCard';
import ThemeSelector from '@/components/account/ThemeSelector';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import usePageTitle from '@/hooks/usePageTitle';

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

/**
 * Página privada `/app/cuenta`: perfil (nombre editable), categorías propias, tema de la app,
 * notificaciones (REQ-029 y REQ-030) y cierre de sesión.
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

      <div className="flex flex-col gap-5">
        <ProfileCard />

        <CustomCategories />

        <Section id="apariencia" title="Apariencia" description="Elige cómo se ve FinTrack.">
          <ThemeSelector />
        </Section>

        <NotificationSettings />

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
      </div>
    </div>
  );
}
