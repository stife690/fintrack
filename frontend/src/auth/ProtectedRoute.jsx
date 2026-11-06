import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import TermsGate from '@/components/legal/TermsGate';
import { useAuth } from './AuthContext';
import { clearReturnToIfReached, saveReturnTo } from './returnTo';

/**
 * Guardia de las rutas privadas. Si hay sesión muestra la página pedida (`<Outlet />`);
 * si no, manda al login y recuerda a dónde quería ir el usuario: en `state.from` y en el
 * dispositivo (`saveReturnTo`), para que sobreviva al registro, a Google o a una recarga.
 * Con sesión, `TermsGate` pide aceptar los términos a quien aún no aceptó la versión vigente.
 */
export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname + location.search;

  // Al llegar con sesión a la ruta guardada (p. ej. la invitación), ya no hace falta recordarla.
  useEffect(() => {
    if (user) clearReturnToIfReached(path);
  }, [user, path]);

  if (!user) {
    saveReturnTo(path);
    return <Navigate to="/login" replace state={{ from: path }} />;
  }
  return (
    <>
      <Outlet />
      <TermsGate />
    </>
  );
}
