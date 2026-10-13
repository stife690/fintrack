import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogOut, Receipt } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import usePageTitle from '@/hooks/usePageTitle';

/**
 * Página privada provisional (`/app`). Muestra quién inició sesión, da acceso a las
 * transacciones y permite cerrar la sesión.
 */
export default function Dashboard() {
  usePageTitle('Mi cuenta');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const handleSignOut = async () => {
    setLeaving(true);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black p-4 text-center text-white">
      <Logo />
      <h1 className="text-3xl font-semibold tracking-tight">¡Hola!</h1>
      <p className="text-white/60">
        Iniciaste sesión como <span className="text-white">{user.email}</span>.
      </p>
      <Button asChild size="lg">
        <Link to="/app/transacciones">
          <Receipt aria-hidden="true" />
          Mis transacciones
        </Link>
      </Button>
      <Button variant="outline" size="lg" onClick={handleSignOut} disabled={leaving}>
        {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>
    </main>
  );
}
