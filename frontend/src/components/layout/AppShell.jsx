import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeftRight, CircleUserRound, House, Loader2, Sparkles, Target } from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';
import SyncStatus from '@/components/layout/SyncStatus';
import { useAuth } from '@/auth/AuthContext';
import useOfflineSync from '@/hooks/useOfflineSync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { cn } from '@/lib/utils';
import { getProfile } from '@/services/userService';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/** Secciones de la zona privada. `end` evita que "Inicio" quede activo en las subrutas. */
const NAV_ITEMS = [
  { to: '/app', label: 'Inicio', icon: House, end: true },
  { to: '/app/transacciones', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/app/presupuestos', label: 'Presupuestos', icon: Target },
  { to: '/app/insights', label: 'Insights', icon: Sparkles },
  { to: '/app/cuenta', label: 'Cuenta', icon: CircleUserRound },
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
 * Menú lateral para tablet y computador. En tablet (md) muestra solo íconos;
 * desde lg, íconos con nombre y el usuario abajo.
 */
function Sidebar({ user }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-ink/10 bg-surface px-3 py-5 md:flex lg:w-64 lg:px-4">
      <Link
        to="/app"
        className="flex items-center gap-2.5 rounded-xl px-2 text-xl font-semibold tracking-tight max-lg:justify-center"
        aria-label="FinTrack, ir al inicio"
      >
        <LogoMark />
        <span className="max-lg:sr-only">FinTrack</span>
      </Link>

      <nav aria-label="Principal" className="mt-8 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
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
        ))}
      </nav>

      <Link
        to="/app/cuenta"
        className="mt-auto flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-ink/5 max-lg:justify-center"
      >
        <Avatar user={user} />
        <span className="min-w-0 max-lg:sr-only">
          <span className="block truncate text-sm font-medium">{getDisplayName(user) || 'Tu cuenta'}</span>
          <span className="block truncate text-xs text-ink/60">{user.email}</span>
        </span>
      </Link>
    </aside>
  );
}

/** Barra inferior para celular, por encima del indicador de inicio de iPhone (safe area). */
function BottomNav() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                  isActive ? 'text-brand' : 'text-ink/60 hover:text-ink',
                )
              }
            >
              <Icon className="size-[22px]" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

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
        <header className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
          <Link to="/app" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <LogoMark className="size-7" />
            FinTrack
          </Link>
          <Link to="/app/cuenta" aria-label="Tu cuenta">
            <Avatar user={user} />
          </Link>
        </header>

        <SyncStatus
          online={online}
          pending={pending}
          rejected={rejected}
          conflicts={conflicts}
          conflictsLost={conflictsLost}
          syncing={syncing}
        />

        <main
          id="contenido"
          className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-12 md:pt-8"
        >
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<SectionFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

/**
 * Marco de la zona privada: menú (lateral en tablet y computador, inferior en celular),
 * aviso de conexión y el tema claro u oscuro elegido en Cuenta.
 */
export default function AppShell() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
