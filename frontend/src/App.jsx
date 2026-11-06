import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import ErrorBoundary, { hasChunkFailed } from '@/components/common/ErrorBoundary';
import ScrollMemory from '@/components/common/ScrollMemory';
import UpdatePrompt from '@/components/common/UpdatePrompt';
import ProtectedRoute from '@/auth/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';

// Code splitting por ruta: cada página (también la landing, con framer-motion) se descarga solo al visitarla.
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Dashboard = lazy(() => import('@/pages/app/Dashboard'));
const Welcome = lazy(() => import('@/pages/app/Welcome'));
const MiPlata = lazy(() => import('@/pages/app/MiPlata'));
const Calendar = lazy(() => import('@/pages/app/Calendar'));
const PeriodDetail = lazy(() => import('@/pages/app/PeriodDetail'));
const Notifications = lazy(() => import('@/pages/app/Notifications'));
const BudgetDetail = lazy(() => import('@/pages/app/BudgetDetail'));
const FixBalance = lazy(() => import('@/pages/app/FixBalance'));
const MoneyPayments = lazy(() => import('@/pages/app/MoneyPayments'));
const Anotar = lazy(() => import('@/pages/app/Anotar'));
const TransactionEdit = lazy(() => import('@/pages/app/TransactionEdit'));
const TransactionDetail = lazy(() => import('@/pages/app/TransactionDetail'));
const Budgets = lazy(() => import('@/pages/app/Budgets'));
const Insights = lazy(() => import('@/pages/app/Insights'));
const Export = lazy(() => import('@/pages/app/Export'));
const Account = lazy(() => import('@/pages/app/Account'));
const Renta = lazy(() => import('@/pages/app/Renta'));
const Invite = lazy(() => import('@/pages/app/Invite'));
const Plans = lazy(() => import('@/pages/app/Plans'));
const Roadmap = lazy(() => import('@/pages/app/Roadmap'));
const IdeasAdmin = lazy(() => import('@/pages/app/IdeasAdmin'));
const Vacas = lazy(() => import('@/pages/app/Vacas'));
const Metas = lazy(() => import('@/pages/app/Metas'));
const Cards = lazy(() => import('@/pages/app/Cards'));
const CardDetail = lazy(() => import('@/pages/app/CardDetail'));
const Debts = lazy(() => import('@/pages/app/Debts'));
const PendingPayments = lazy(() => import('@/pages/app/PendingPayments'));
const VacaDetail = lazy(() => import('@/pages/app/VacaDetail'));
const VacaJoin = lazy(() => import('@/pages/app/VacaJoin'));
const Negocios = lazy(() => import('@/pages/app/Negocios'));
const NegocioDetail = lazy(() => import('@/pages/app/NegocioDetail'));
const NegocioJoin = lazy(() => import('@/pages/app/NegocioJoin'));

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
 * La pantalla vieja de Movimientos ya no existe; su dirección sigue en accesos de la app instalada y en
 * avisos ya enviados. `?nuevo=gasto|ingreso` lleva a anotar y lo demás, a Mi plata.
 */
function OldMovements() {
  const [params] = useSearchParams();
  const type = params.get('nuevo');
  return <Navigate to={type ? `/app/anotar?tipo=${type === 'ingreso' ? 'ingreso' : 'gasto'}` : '/app/mi-plata'} replace />;
}

/**
 * Rutas del frontend:
 * `/` landing · `/login` inicio de sesión · `/registro` crear cuenta · `/recuperar` pedir el enlace
 * para cambiar la contraseña · `/restablecer` contraseña nueva (enlace del correo) ·
 * `/verificar` confirmar el correo al registrarse (enlace del correo, FT-0016) · `*` 404.
 * Zona privada, dentro del marco con menú (`AppShell`): `/app` inicio · `/app/mi-plata` saldo y movimientos · `/app/transacciones/nuevo` y `/app/transacciones/:id/editar` formulario completo ·
 * `/app/presupuestos` presupuestos por categoría y mes · `/app/insights` consejos con IA ·
 * `/app/transacciones/exportar` descarga de movimientos · `/app/cuenta` tema, notificaciones y sesión ·
 * `/app/renta` enlaces a la DIAN · `/app/invitar` compartir FinTrack · `/app/planes` planes de ejemplo ·
 * `/app/lo-que-viene` ideas y votos · `/app/lo-que-viene/admin` panel del equipo ·
 * `/app/metas` metas de ahorro personales (vacas de una sola persona) · `/app/metas/:id` su avance ·
 * `/app/vacas` metas de ahorro en grupo · `/app/vacas/:id` seguimiento de aportes · `/app/vacas/unirse/:code`
 * enlace de invitación (FT-0014/FT-0015) · `/app/negocios` emprendimientos compartidos · `/app/negocios/:id`
 * socios y roles · `/app/negocios/unirse/:code` enlace de invitación (FT-0016).
 * `/app/mi-plata` ingresos, saldo y pagos de cada mes (FT-0041).
 * `/app/calendario` pagos del mes y cuánto queda después de cada uno (FT-0025).
 * `/app/notificaciones` lista de avisos, desde la campana del inicio.
 * Fuera del marco: `/app/bienvenida` preguntas de la primera vez (FT-0036).
 */
export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollMemory />
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
            <Route path="/verificar" element={<VerifyEmail />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/app/bienvenida" element={<Welcome />} />
              <Route element={<AppShell />}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/app/transacciones" element={<OldMovements />} />
                <Route path="/app/transacciones/nuevo" element={<TransactionEdit />} />
                <Route path="/app/transacciones/:id/editar" element={<TransactionEdit />} />
                <Route path="/app/presupuestos" element={<Budgets />} />
                <Route path="/app/insights" element={<Insights />} />
                <Route path="/app/transacciones/exportar" element={<Export />} />
                <Route path="/app/transacciones/:id" element={<TransactionDetail />} />
                <Route path="/app/cuenta" element={<Account />} />
                <Route path="/app/mi-plata" element={<MiPlata />} />
                <Route path="/app/calendario" element={<Calendar />} />
                <Route path="/app/mes" element={<Navigate to="/app/gastos" replace />} />
                <Route path="/app/ingresos" element={<PeriodDetail type="ingreso" />} />
                <Route path="/app/gastos" element={<PeriodDetail type="gasto" />} />
                <Route path="/app/mi-plata/pagos" element={<MoneyPayments />} />
                <Route path="/app/mi-plata/corregir" element={<FixBalance />} />
                <Route path="/app/presupuestos/:category" element={<BudgetDetail />} />
                <Route path="/app/anotar" element={<Anotar />} />
                <Route path="/app/renta" element={<Renta />} />
                <Route path="/app/invitar" element={<Invite />} />
                <Route path="/app/planes" element={<Plans />} />
                <Route path="/app/lo-que-viene" element={<Roadmap />} />
                <Route path="/app/lo-que-viene/admin" element={<IdeasAdmin />} />
                <Route path="/app/tarjetas" element={<Cards />} />
                <Route path="/app/tarjetas/:id" element={<CardDetail />} />
                <Route path="/app/cuentas" element={<Debts />} />
                <Route path="/app/por-confirmar" element={<PendingPayments />} />
                <Route path="/app/metas" element={<Metas />} />
                <Route path="/app/metas/:id" element={<VacaDetail />} />
                <Route path="/app/vacas" element={<Vacas />} />
                <Route path="/app/vacas/unirse/:code" element={<VacaJoin />} />
                <Route path="/app/vacas/:id" element={<VacaDetail />} />
                <Route path="/app/negocios" element={<Negocios />} />
                <Route path="/app/negocios/unirse/:code" element={<NegocioJoin />} />
                <Route path="/app/negocios/:id" element={<NegocioDetail />} />
                <Route path="/app/notificaciones" element={<Notifications />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
