import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, PiggyBank, Users } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { formatDate } from '@/components/transactions/format';
import { formatPesos } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { joinVaca, previewInvitation } from '@/services/vacaService';

/**
 * Página privada `/app/vacas/unirse/:code` (FT-0014): a donde lleva el enlace de invitación.
 * Muestra la vaca y quién invita antes de unirse. Si no hay sesión, `ProtectedRoute` manda al
 * login (o al registro) y vuelve aquí después.
 */
export default function VacaJoin() {
  usePageTitle('Unirse a una vaca');
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

  if (preview?.isMember) return <Navigate to={`/app/vacas/${preview.id}`} replace />;

  const join = async () => {
    setJoining(true);
    setError('');
    try {
      const vaca = await joinVaca(code);
      navigate(`/app/vacas/${vaca.id}`, { replace: true, state: { joined: true } });
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <Panel className="text-center">
        <PiggyBank className="mx-auto size-12 text-brand" aria-hidden="true" />
        {!online ? (
          <p className="mt-4 text-ink/60">Necesitas conexión para unirte a una vaca. Vuelve a intentarlo con internet.</p>
        ) : error && !preview ? (
          <>
            <p role="alert" className="mt-4 font-medium text-negative">
              {error}
            </p>
            <p className="mt-2 text-ink/60">Pídele a quien te invitó el enlace o el código nuevo.</p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/app/vacas">Ir a mis vacas</Link>
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
            <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-ink/5 p-4 text-sm">
              <div>
                <dt className="text-ink/60">Meta</dt>
                <dd className="font-semibold tabular-nums">{formatPesos(preview.goal)}</dd>
              </div>
              <div>
                <dt className="text-ink/60">Reunido</dt>
                <dd className="font-semibold tabular-nums">{formatPesos(preview.total)}</dd>
              </div>
              <div>
                <dt className="text-ink/60">Miembros</dt>
                <dd className="inline-flex items-center gap-1 font-semibold">
                  <Users className="size-3.5" aria-hidden="true" /> {preview.membersCount}
                </dd>
              </div>
            </dl>
            {preview.deadline && (
              <p className="mt-3 text-sm text-ink/60">Fecha límite: {formatDate(preview.deadline)}</p>
            )}
            <p className="mt-4 text-sm text-ink/60">
              Los demás verán tu nombre y tus aportes. Cada aporte también queda como un gasto en tus movimientos.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-negative">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-center gap-3">
              <Button size="lg" onClick={join} disabled={joining}>
                {joining && <Loader2 className="animate-spin" aria-hidden="true" />}
                Unirme a la vaca
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/app/vacas">Ahora no</Link>
              </Button>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
