import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary, { hasChunkFailed } from '@/components/common/ErrorBoundary';
import UpdatePrompt from '@/components/common/UpdatePrompt';
import ProtectedRoute from '@/auth/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';

// Code splitting por ruta: cada página (también la landing, con framer-motion) se descarga solo al visitarla.
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Dashboard = lazy(() => import('@/pages/app/Dashboard'));
const Transactions = lazy(() => import('@/pages/app/Transactions'));
const Budgets = lazy(() => import('@/pages/app/Budgets'));
const Insights = lazy(() => import('@/pages/app/Insights'));
const Export = lazy(() => import('@/pages/app/Export'));
const Account = lazy(() => import('@/pages/app/Account'));
const Renta = lazy(() => import('@/pages/app/Renta'));
const Invite = lazy(() => import('@/pages/app/Invite'));
const Plans = lazy(() => import('@/pages/app/Plans'));
const Vacas = lazy(() => import('@/pages/app/Vacas'));
const VacaDetail = lazy(() => import('@/pages/app/VacaDetail'));
const VacaJoin = lazy(() => import('@/pages/app/VacaJoin'));
const Negocios = lazy(() => import('@/pages/app/Negocios'));
const NegocioDetail = lazy(() => import('@/pages/app/NegocioDetail'));
const NegocioJoin = lazy(() => import('@/pages/app/NegocioJoin'));

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
 * `/` landing · `/login` inicio de sesión · `/registro` crear cuenta · `/recuperar` pedir el enlace
 * para cambiar la contraseña · `/restablecer` contraseña nueva (enlace del correo) · `*` 404.
 * Zona privada, dentro del marco con menú (`AppShell`): `/app` inicio · `/app/transacciones` registro y listado ·
 * `/app/presupuestos` presupuestos por categoría y mes · `/app/insights` consejos con IA ·
 * `/app/transacciones/exportar` descarga de movimientos · `/app/cuenta` tema, notificaciones y sesión ·
 * `/app/renta` enlaces a la DIAN · `/app/invitar` compartir FinTrack · `/app/planes` planes de ejemplo ·
 * `/app/vacas` metas de ahorro en grupo · `/app/vacas/:id` seguimiento de aportes · `/app/vacas/unirse/:code`
 * enlace de invitación (FT-0014/FT-0015) · `/app/negocios` emprendimientos compartidos · `/app/negocios/:id`
 * socios y roles · `/app/negocios/unirse/:code` enlace de invitación (FT-0016).
 * `/app/notificaciones` se conserva y redirige a Cuenta (enlaces viejos o instalados).
 */
export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollToTop />
      <ReloadAfterChunkError />
      {/* Aviso de versión nueva (FT-0020): fuera de las rutas, sale en cualquier pantalla. */}
      <UpdatePrompt />
      {/* key: al cambiar de ruta se monta un boundary nuevo y se limpia el error anterior. */}
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route path="/restablecer" element={<ResetPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/app/transacciones" element={<Transactions />} />
                <Route path="/app/presupuestos" element={<Budgets />} />
                <Route path="/app/insights" element={<Insights />} />
                <Route path="/app/transacciones/exportar" element={<Export />} />
                <Route path="/app/cuenta" element={<Account />} />
                <Route path="/app/renta" element={<Renta />} />
                <Route path="/app/invitar" element={<Invite />} />
                <Route path="/app/planes" element={<Plans />} />
                <Route path="/app/vacas" element={<Vacas />} />
                <Route path="/app/vacas/unirse/:code" element={<VacaJoin />} />
                <Route path="/app/vacas/:id" element={<VacaDetail />} />
                <Route path="/app/negocios" element={<Negocios />} />
                <Route path="/app/negocios/unirse/:code" element={<NegocioJoin />} />
                <Route path="/app/negocios/:id" element={<NegocioDetail />} />
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
