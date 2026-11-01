import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Briefcase, Loader2, Users } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { ROLES } from '@/components/negocios/negocioFormat';
import { Button } from '@/components/ui/button';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { joinBusiness, previewInvitation } from '@/services/negocioService';

/**
 * Página privada `/app/negocios/unirse/:code` (FT-0016): a donde lleva el enlace de invitación.
 * Muestra el negocio, quién invita y con qué rol se entra. Si no hay sesión, `ProtectedRoute`
 * manda al login (o al registro) y vuelve aquí después.
 */
export default function NegocioJoin() {
  usePageTitle('Unirse a un negocio');
  const { code } = useParams();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!online) return undefined;
    let cancelled = false;
    setError('');
    previewInvitation(code)
      .then((data) => !cancelled && setPreview(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [code, online]);

  if (preview?.isMember) return <Navigate to={`/app/negocios/${preview.id}`} replace />;

  const join = async () => {
    setJoining(true);
    setError('');
    try {
      const business = await joinBusiness(code);
      navigate(`/app/negocios/${business.id}`, { replace: true, state: { joined: true } });
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  const role = preview && ROLES[preview.role];

  return (
    <div className="mx-auto max-w-lg">
      <Panel className="text-center">
        <Briefcase className="mx-auto size-12 text-brand" aria-hidden="true" />
        {!online ? (
          <p className="mt-4 text-ink/60">Necesitas conexión para unirte a un negocio. Vuelve a intentarlo con internet.</p>
        ) : error && !preview ? (
          <>
            <p role="alert" className="mt-4 font-medium text-negative">
              {error}
            </p>
            <p className="mt-2 text-ink/60">Pídele a quien te invitó el enlace o el código nuevo.</p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/app/negocios">Ir a mis negocios</Link>
            </Button>
          </>
        ) : !preview ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-ink/60">
            <Loader2 className="animate-spin" aria-hidden="true" /> Cargando la invitación…
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-ink/60">
              {preview.createdBy ? `${preview.createdBy} te invitó a` : 'Te invitaron a'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{preview.name}</h1>
            {preview.description && <p className="mt-2 text-ink/70">{preview.description}</p>}
            <dl className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-ink/5 p-4 text-sm">
              <div>
                <dt className="text-ink/60">Entras como</dt>
                <dd className="font-semibold">{role.label}</dd>
              </div>
              <div>
                <dt className="text-ink/60">Socios</dt>
                <dd className="inline-flex items-center gap-1 font-semibold">
                  <Users className="size-3.5" aria-hidden="true" /> {preview.membersCount}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-ink/60">
              {role.hint}. Los demás socios verán tu nombre. Las finanzas del negocio quedan aparte de las tuyas.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-negative">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-center gap-3">
              <Button size="lg" onClick={join} disabled={joining}>
                {joining && <Loader2 className="animate-spin" aria-hidden="true" />}
                Unirme al negocio
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/app/negocios">Ahora no</Link>
              </Button>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
