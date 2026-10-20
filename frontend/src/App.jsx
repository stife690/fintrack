import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Home from '@/pages/Home';
import ErrorBoundary, { hasChunkFailed } from '@/components/common/ErrorBoundary';
import ProtectedRoute from '@/auth/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';

// Code splitting por ruta: login/registro/404 se descargan solo al visitarlas.
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Dashboard = lazy(() => import('@/pages/app/Dashboard'));
const Transactions = lazy(() => import('@/pages/app/Transactions'));
const Budgets = lazy(() => import('@/pages/app/Budgets'));
const Insights = lazy(() => import('@/pages/app/Insights'));
const Account = lazy(() => import('@/pages/app/Account'));

/** Lleva el scroll arriba al cambiar de página (salvo al navegar a un #ancla). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/**
 * Si un chunk falló antes (ver ErrorBoundary), al navegar con conexión se recarga la
 * página completa: es la única forma de que el navegador vuelva a intentar el import.
 */
function ReloadAfterChunkError() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (hasChunkFailed() && navigator.onLine) window.location.reload();
  }, [pathname]);
  return null;
}

/**
 * Pantalla vacía mientras carga una ruta diferida. Negra en la landing; en /app usa el fondo del
 * tema que index.html dejó en `--boot-bg`, así no hay destello al abrir en modo claro.
 */
function RouteFallback() {
  return <div className="min-h-dvh bg-[var(--boot-bg,#000)]" aria-busy="true" />;
}

/**
 * Rutas del frontend:
 * `/` landing · `/login` inicio de sesión · `/registro` crear cuenta · `*` 404.
 * Zona privada, dentro del marco con menú (`AppShell`): `/app` inicio · `/app/transacciones` registro y listado ·
 * `/app/presupuestos` presupuestos por categoría y mes · `/app/cuenta` tema, notificaciones y sesión.
 * `/app/notificaciones` se conserva y redirige a Cuenta (enlaces viejos o instalados).
 */
export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollToTop />
      <ReloadAfterChunkError />
      {/* key: al cambiar de ruta se monta un boundary nuevo y se limpia el error anterior. */}
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/app/transacciones" element={<Transactions />} />
                <Route path="/app/presupuestos" element={<Budgets />} />
                <Route path="/app/insights" element={<Insights />} />
                <Route path="/app/cuenta" element={<Account />} />
                <Route path="/app/notificaciones" element={<Navigate to="/app/cuenta" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
