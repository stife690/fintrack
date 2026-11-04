import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  HandCoins,
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  Crown,
  House,
  Landmark,
  Lightbulb,
  Loader2,
  PiggyBank,
  Sparkles,
  Target,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';
import NotificationBell from '@/components/layout/NotificationBell';
import { NotificationsProvider, useNotifications } from '@/components/layout/NotificationsProvider';
import SyncStatus from '@/components/layout/SyncStatus';
import QuickEntryBar from '@/components/transactions/QuickEntryBar';
import { useAuth } from '@/auth/AuthContext';
import useOfflineSync from '@/hooks/useOfflineSync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { backPath, canGoBack } from '@/lib/backPath';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { cn } from '@/lib/utils';
import { getProfile } from '@/services/userService';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/**
 * Secciones de la zona privada, por grupos: las finanzas propias, lo que se maneja con otras
 * personas y la app. `end` evita que "Inicio" quede activo en las subrutas. Cuenta va aparte (el usuario,
 * abajo en el menú lateral). En el celular no hay menú: se llega desde el inicio y desde Cuenta.
 */
const NAV_GROUPS = [
  {
    label: 'Mis finanzas',
    items: [
      { to: '/app', label: 'Inicio', icon: House, end: true },
      { to: '/app/transacciones', label: 'Movimientos', short: 'Movim.', icon: ArrowLeftRight },
      { to: '/app/presupuestos', label: 'Presupuestos', icon: Target },
      { to: '/app/insights', label: 'Consejos', icon: Sparkles },
      { to: '/app/mi-plata', label: 'Mi plata', icon: Wallet },
      { to: '/app/tarjetas', label: 'Tarjetas', icon: CreditCard },
      { to: '/app/cuentas', label: 'Cuentas', icon: HandCoins },
      { to: '/app/calendario', label: 'Calendario', icon: CalendarDays },
      { to: '/app/renta', label: 'Renta y DIAN', icon: Landmark },
    ],
  },
  {
    label: 'En grupo',
    items: [
      { to: '/app/vacas', label: 'Vacas', icon: PiggyBank },
      { to: '/app/negocios', label: 'Negocios', icon: Briefcase },
    ],
  },
  {
    label: 'FinTrack',
    items: [
      { to: '/app/invitar', label: 'Invitar amigos', icon: UserPlus },
      { to: '/app/planes', label: 'Planes', icon: Crown },
      { to: '/app/lo-que-viene', label: 'Lo que viene', icon: Lightbulb },
    ],
  },
];

/** Círculo con la inicial del usuario. */
function Avatar({ user, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand',
        className,
      )}
    >
      {getInitial(user)}
    </span>
  );
}

/**
 * Menú lateral para tablet y computador, con las secciones agrupadas. En tablet (md) muestra
 * solo íconos (los grupos se separan con una línea); desde lg, íconos con nombre y el usuario abajo.
 */
function Sidebar({ user }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col overflow-y-auto border-r border-ink/10 bg-surface px-3 py-5 md:flex lg:w-64 lg:px-4">
      <Link
        to="/app"
        className="flex items-center gap-2.5 rounded-xl px-2 text-xl font-semibold tracking-tight max-lg:justify-center"
        aria-label="FinTrack, ir al inicio"
      >
        <LogoMark />
        <span className="max-lg:sr-only">FinTrack</span>
      </Link>
      <NotificationBell label labelClassName="max-lg:sr-only" className="mt-4 w-full pr-3 max-lg:justify-center max-lg:pr-0" />

      <nav aria-label="Principal" className="mt-8 flex flex-col gap-6">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label} className={cn(index > 0 && 'max-lg:border-t max-lg:border-ink/10 max-lg:pt-6')}>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink/40 max-lg:sr-only">
              {group.label}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    title={label}
                    className={({ isActive }) =>
                      cn(
                        'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors max-lg:justify-center',
                        isActive ? 'bg-brand-soft text-brand' : 'text-ink/60 hover:bg-ink/5 hover:text-ink',
                      )
                    }
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="max-lg:sr-only">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <NavLink
        to="/app/cuenta"
        title="Cuenta"
        className={({ isActive }) =>
          cn(
            'mt-auto flex items-center gap-3 rounded-xl p-2 transition-colors max-lg:justify-center',
            isActive ? 'bg-brand-soft' : 'hover:bg-ink/5',
          )
        }
      >
        <Avatar user={user} />
        <span className="min-w-0 max-lg:sr-only">
          <span className="block truncate text-sm font-medium">{getDisplayName(user) || 'Tu cuenta'}</span>
          <span className="block truncate text-xs text-ink/60">{user.email}</span>
        </span>
      </NavLink>
    </aside>
  );
}

/**
 * Encabezado del celular. En el inicio, el avatar a la izquierda, con un punto si hay avisos sin leer (la
 * lista está en Cuenta). En las demás pantallas, el botón para volver: atrás en el historial o, si la
 * pantalla se abrió directo (un enlace, un aviso), a la pantalla de la que cuelga.
 */
function MobileHeader({ user }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { unread } = useNotifications();
  const parent = backPath(pathname);

  if (parent) {
    return (
      <header className="flex items-center px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => (canGoBack(window.history.state) ? navigate(-1) : navigate(parent, { replace: true }))}
          className="grid size-11 place-items-center rounded-full transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </button>
      </header>
    );
  }

  return (
    <header className="flex items-center px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
      <Link
        to="/app/cuenta"
        aria-label={unread === 0 ? 'Tu cuenta' : `Tu cuenta, ${unread} ${unread === 1 ? 'aviso' : 'avisos'} sin leer`}
        className="relative grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-violet"
      >
        <Avatar user={user} />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-3 rounded-full bg-brand ring-2 ring-canvas" />
        )}
      </Link>
    </header>
  );
}

/** Pantallas con la barra rápida para anotar desde tablet (FT-0013): donde se registran los movimientos. */
const QUICK_ENTRY_PATHS = ['/app', '/app/transacciones'];

/** Pantallas con una barra fija abajo en el celular: la de anotar o la caja del asistente (Consejos). */
const BOTTOM_BAR_PATHS = [...QUICK_ENTRY_PATHS, '/app/insights'];

/** Se trae el perfil una vez por carga de la app (el marco se vuelve a montar al cambiar de ruta). */
let profileSynced = false;

/**
 * Actualiza el nombre guardado en la sesión con el del servidor, por si se cambió en otro
 * dispositivo. Sin conexión o si falla, se queda con el que ya tenía.
 */
function useSyncProfile() {
  const { updateUser } = useAuth();
  useEffect(() => {
    if (profileSynced) return;
    profileSynced = true;
    getProfile()
      .then((profile) => 'name' in profile && updateUser({ name: profile.name }))
      .catch(() => {
        profileSynced = false; // se reintenta en la próxima navegación
      });
  }, [updateUser]);
}

/** Mientras descarga el código de una sección, el menú sigue visible. */
function SectionFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-ink/60" aria-busy="true">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function Shell() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const { pending, rejected, conflicts, conflictsLost, syncing } = useOfflineSync();
  const { pathname } = useLocation();
  const quickEntry = QUICK_ENTRY_PATHS.includes(pathname);
  const bottomBar = BOTTOM_BAR_PATHS.includes(pathname);
  useSyncProfile();

  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas text-ink antialiased md:flex">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <Sidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader user={user} />

        <SyncStatus
          online={online}
          pending={pending}
          rejected={rejected}
          conflicts={conflicts}
          conflictsLost={conflictsLost}
          syncing={syncing}
        />

        {/* Abajo va la barra rápida donde se puede anotar: que no tape el final. */}
        <main
          id="contenido"
          className={cn(
            'flex-1 px-4 pt-2 md:px-8 md:pt-8',
            bottomBar ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]',
            quickEntry ? 'md:pb-28' : 'md:pb-12',
          )}
        >
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<SectionFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {quickEntry && <QuickEntryBar />}
    </div>
  );
}

/**
 * Marco de la zona privada: menú lateral en tablet y computador, botón de volver en celular,
 * aviso de conexión y el tema claro u oscuro elegido en Cuenta.
 */
export default function AppShell() {
  return (
    <ThemeProvider>
      <NotificationsProvider>
        <Shell />
      </NotificationsProvider>
    </ThemeProvider>
  );
}
