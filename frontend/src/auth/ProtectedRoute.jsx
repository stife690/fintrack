import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Guardia de las rutas privadas. Si hay sesión muestra la página pedida (`<Outlet />`);
 * si no, manda al login y recuerda a dónde quería ir el usuario (`state.from`).
 */
export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
