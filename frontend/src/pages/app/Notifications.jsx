import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/common/Logo';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { Button } from '@/components/ui/button';
import usePageTitle from '@/hooks/usePageTitle';

/**
 * Página privada `/app/notificaciones`: activar las notificaciones del dispositivo
 * y programar el recordatorio diario.
 */
export default function Notifications() {
  usePageTitle('Notificaciones');

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link to="/app">
            <ArrowLeft aria-hidden="true" />
            Volver
          </Link>
        </Button>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-12">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Notificaciones</h1>
        <NotificationSettings />
      </main>
    </div>
  );
}
