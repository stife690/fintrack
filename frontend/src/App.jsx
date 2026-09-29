import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from '@/pages/Home';
import ErrorBoundary, { hasChunkFailed } from '@/components/common/ErrorBoundary';

// Code splitting por ruta: login/registro/404 se descargan solo al visitarlas.
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const NotFound = lazy(() => import('@/pages/NotFound'));

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

/** Pantalla negra mientras carga una ruta diferida (evita un destello blanco). */
function RouteFallback() {
  return <div className="min-h-dvh bg-black" aria-busy="true" />;
}

/**
 * Rutas del frontend:
 * `/` landing · `/login` inicio de sesión · `/registro` crear cuenta · `*` 404.
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
