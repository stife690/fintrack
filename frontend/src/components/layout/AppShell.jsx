import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeftRight, Briefcase, House, Loader2, PiggyBank, Sparkles, Target, Users } from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';
import SyncStatus from '@/components/layout/SyncStatus';
import QuickEntryBar from '@/components/transactions/QuickEntryBar';
import { useAuth } from '@/auth/AuthContext';
import useOfflineSync from '@/hooks/useOfflineSync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { cn } from '@/lib/utils';
import { getProfile } from '@/services/userService';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/**
 * Secciones de la zona privada, en dos grupos: las finanzas propias y lo que se maneja con otras
 * personas. `end` evita que "Inicio" quede activo en las subrutas. Cuenta va aparte (el usuario,
 * abajo en el menú lateral, y el avatar arriba en el celular).
 */
const NAV_GROUPS = [
  {
    label: 'Mis finanzas',
    items: [
      { to: '/app', label: 'Inicio', icon: House, end: true },
      { to: '/app/transacciones', label: 'Movimientos', short: 'Movim.', icon: ArrowLeftRight },
      { to: '/app/presupuestos', label: 'Presupuestos', short: 'Presup.', icon: Target },
      { to: '/app/insights', label: 'Insights', icon: Sparkles },
    ],
  },
  {
    label: 'En grupo',
    items: [
      { to: '/app/vacas', label: 'Vacas', icon: PiggyBank },
      { to: '/app/negocios', label: 'Negocios', icon: Briefcase },
    ],
  },
];

/** Secciones que la barra del celular junta en "Grupos" (se cambia entre ellas con `GroupSwitch`). */
const GROUP_PATHS = ['/app/vacas', '/app/negocios'];
const LAST_GROUP_KEY = 'fintrack:ultimoGrupo';

/**
 * Barra del celular: cinco botones. Vacas y Negocios comparten "Grupos", que vuelve a la última
 * de las dos que se abrió.
 * @param {string} lastGroup
 */
function bottomItems(lastGroup) {
  const [mine] = NAV_GROUPS;
  return [
    ...mine.items.slice(0, 3),
    { to: lastGroup, label: 'Grupos', icon: Users, match: GROUP_PATHS },
    mine.items[3],
  ];
}

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
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-ink/10 bg-surface px-3 py-5 md:flex lg:w-64 lg:px-4">
      <Link
        to="/app"
        className="flex items-center gap-2.5 rounded-xl px-2 text-xl font-semibold tracking-tight max-lg:justify-center"
        aria-label="FinTrack, ir al inicio"
      >
        <LogoMark />
        <span className="max-lg:sr-only">FinTrack</span>
      </Link>

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
 * Última sección de grupo abierta (Vacas o Negocios), para que "Grupos" vuelva a ella.
 * @param {string} pathname
 * @returns {string}
 */
function useLastGroup(pathname) {
  const current = GROUP_PATHS.find((path) => pathname.startsWith(path));
  const [last, setLast] = useState(() => {
    try {
      const saved = sessionStorage.getItem(LAST_GROUP_KEY);
      return GROUP_PATHS.includes(saved) ? saved : GROUP_PATHS[0];
    } catch {
      return GROUP_PATHS[0];
    }
  });
  useEffect(() => {
    if (!current) return;
    setLast(current);
    try {
      sessionStorage.setItem(LAST_GROUP_KEY, current);
    } catch {
      // Sin almacenamiento: "Grupos" abre Vacas.
    }
  }, [current]);
  return last;
}

/** Barra inferior para celular, por encima del indicador de inicio de iPhone (safe area). */
function BottomNav() {
  const { pathname } = useLocation();
  const lastGroup = useLastGroup(pathname);
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {bottomItems(lastGroup).map(({ to, label, short, icon: Icon, end, match }) => {
          const groupActive = match?.some((path) => pathname.startsWith(path));
          return (
            <li key={label} className="min-w-0">
              <NavLink
                to={to}
                end={end}
                aria-label={short ? label : undefined}
                aria-current={groupActive ? 'page' : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-medium transition-colors',
                    isActive || groupActive ? 'text-brand' : 'text-ink/60 hover:text-ink',
                  )
                }
              >
                <Icon className="size-[22px] shrink-0" aria-hidden="true" />
                {/* En pantallas muy angostas (320 px) los nombres largos no caben: se acortan. */}
                <span className={cn('max-w-full truncate', short && 'max-[359px]:hidden')} aria-hidden={short ? true : undefined}>
                  {label}
                </span>
                {short && (
                  <span className="hidden max-[359px]:inline" aria-hidden="true">
                    {short}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Pantallas con la barra rápida para anotar (FT-0013): donde se registra y se ven los movimientos. */
const QUICK_ENTRY_PATHS = ['/app', '/app/transacciones'];

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

        {/* Con la barra rápida abajo, más espacio al final para que no tape el último elemento. */}
        <main
          id="contenido"
          className={cn(
            'flex-1 px-4 pt-4 md:px-8 md:pt-8',
            quickEntry
              ? 'pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-28'
              : 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12',
          )}
        >
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<SectionFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <BottomNav />
      {quickEntry && <QuickEntryBar />}
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
