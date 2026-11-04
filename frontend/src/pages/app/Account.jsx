import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Download, Lightbulb, Loader2, LogOut, UserPlus } from 'lucide-react';
import CustomCategories from '@/components/account/CustomCategories';
import DeleteAccount from '@/components/account/DeleteAccount';
import ProfileCard from '@/components/account/ProfileCard';
import ThemeSelector from '@/components/account/ThemeSelector';
import WhatsappLink from '@/components/account/WhatsappLink';
import NotificationBell from '@/components/layout/NotificationBell';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import useMediaQuery from '@/hooks/useMediaQuery';
import usePageTitle from '@/hooks/usePageTitle';
import { getDisplayName, getInitial } from '@/lib/displayName';
import Sheet from '@/components/common/Sheet';

/** Lo que se abre desde Cuenta porque no se usa todos los días. */
export const LINKS = [
  { to: '/app/transacciones/exportar', label: 'Exportar reportes', detail: 'Excel, PDF o CSV', icon: Download },
  { to: '/app/invitar', label: 'Invitar amigos', detail: 'Compárteles la app', icon: UserPlus },
  { to: '/app/planes', label: 'Planes', detail: 'Beta: aún no se cobra', icon: Crown },
  { to: '/app/lo-que-viene', label: 'Lo que viene', detail: 'Vota y pide funciones', icon: Lightbulb },
];

/** Bloque con título de una sección de ajustes. */
function Section({ id, title, description, children }) {
  return (
    <Panel aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

/** Grupo de ajustes con su nombre, para ubicar rápido lo que se busca. */
function Group({ label, children }) {
  return (
    <section aria-label={label}>
      <p aria-hidden="true" className="mb-2 px-1 text-sm font-medium text-ink/60">
        {label}
      </p>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

/**
 * Página privada `/app/cuenta`, por grupos: perfil (nombre editable), preferencias
 * (tema de la app y categorías propias), alertas (REQ-029 y REQ-030), cierre de sesión y eliminar la
 * cuenta (FT-0017).
 */
const ROW = 'flex min-h-[52px] w-full items-center justify-between gap-3 text-left text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-violet';

/** Grupo de filas del perfil en el celular. */
function RowGroup({ label, children }) {
  return (
    <section aria-label={label} className="mt-6">
      <h2 className="mb-2 text-sm font-medium text-ink/70">{label}</h2>
      <div className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-surface px-3.5">{children}</div>
    </section>
  );
}

/** Perfil en el celular: una lista corta; cada ajuste se abre en su propia hoja. */
function MobileAccount({ onSignOut, leaving }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(null);
  const row = (key, label) => (
    <button type="button" className={ROW} onClick={() => setOpen(key)}>
      {label}
    </button>
  );
  const close = () => setOpen(null);
  return (
    <>
      <button type="button" onClick={() => setOpen('perfil')} className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-violet">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-brand-soft text-[22px] font-semibold text-brand">
          {getInitial(user)}
        </span>
        <h1 className="text-[28px] font-semibold tracking-tight">{getDisplayName(user) || 'Tu cuenta'}</h1>
      </button>

      <RowGroup label="Preferencias">
        <NotificationBell asRow className={ROW} />
        {row('alertas', 'Alertas y recordatorios')}
        <Link to={LINKS[0].to} className={ROW}>
          {LINKS[0].label}
        </Link>
        {row('categorias', 'Mis categorías')}
        {row('apariencia', 'Apariencia')}
        {row('whatsapp', 'Anotar por WhatsApp')}
      </RowGroup>

      <RowGroup label="FinTrack">
        {LINKS.slice(1).map(({ to, label }) => (
          <Link key={to} to={to} className={ROW}>
            {label}
          </Link>
        ))}
      </RowGroup>

      <RowGroup label="Sesión">
        <button type="button" className={ROW} onClick={onSignOut} disabled={leaving}>
          {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
        <button type="button" className={`${ROW} text-negative`} onClick={() => setOpen('eliminar')}>
          Eliminar cuenta
        </button>
      </RowGroup>

      <Sheet open={open === 'perfil'} title="Tu perfil" onClose={close}>
        <ProfileCard />
      </Sheet>
      <Sheet open={open === 'alertas'} title="Alertas y recordatorios" onClose={close}>
        <NotificationSettings />
      </Sheet>
      <Sheet open={open === 'categorias'} title="Mis categorías" onClose={close}>
        <CustomCategories />
      </Sheet>
      <Sheet open={open === 'apariencia'} title="Apariencia" onClose={close}>
        <ThemeSelector />
      </Sheet>
      <Sheet open={open === 'whatsapp'} title="Anotar por WhatsApp" onClose={close}>
        <WhatsappLink />
      </Sheet>
      <Sheet open={open === 'eliminar'} title="Eliminar cuenta" onClose={close}>
        <DeleteAccount />
      </Sheet>
    </>
  );
}

export default function Account() {
  usePageTitle('Cuenta');
  const mobile = useMediaQuery('(width < 48rem)');
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const handleSignOut = async () => {
    setLeaving(true);
    await signOut();
    navigate('/login', { replace: true });
  };

  if (mobile) return <MobileAccount onSignOut={handleSignOut} leaving={leaving} />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Cuenta" />

      <div className="flex flex-col gap-8">
        <ProfileCard />
        <Group label="Preferencias">
          <Section id="apariencia" title="Apariencia" description="Elige cómo se ve FinTrack.">
            <ThemeSelector />
          </Section>
          <CustomCategories />
          <WhatsappLink />
        </Group>

        <Group label="Alertas">
          <NotificationSettings />
        </Group>

        <Group label="Sesión">
          <Panel className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Cerrar sesión</h2>
              <p className="mt-1 text-sm text-ink/60">Sales de tu cuenta en este dispositivo.</p>
            </div>
            <Button variant="outline" onClick={handleSignOut} disabled={leaving}>
              {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
              {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Button>
          </Panel>
          <DeleteAccount />
        </Group>
      </div>
    </div>
  );
}
