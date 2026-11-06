import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { LEGAL_VERSION } from '@/pages/legal/legalContent';
import { acceptTerms, getProfile } from '@/services/userService';

/** Usuario cuyo perfil ya se consultó en esta carga (si entra otra persona, se consulta de nuevo). */
let checkedFor = null;

/**
 * Pide aceptar los términos y la política de privacidad a quien aún no aceptó la versión vigente
 * (cuentas creadas antes de publicarlos, o cuando se publica una versión nueva) (FT-0017).
 * No se puede cerrar: para seguir usando la app hay que aceptar; si no, se puede cerrar sesión.
 * Los documentos se abren en otra pestaña para no perder la ventana. Va en `ProtectedRoute`, así
 * cubre todas las rutas privadas (también la bienvenida), y averigua sola si falta aceptar.
 */
export default function TermsGate() {
  const { user, updateUser, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef(null);
  const open = user?.termsAccepted === false;
  const userId = user?.id;

  // Sin conexión o si falla no bloquea: se vuelve a consultar en la próxima carga.
  useEffect(() => {
    if (!userId || checkedFor === userId) return;
    checkedFor = userId;
    getProfile()
      .then((profile) => 'termsAccepted' in profile && updateUser({ termsAccepted: profile.termsAccepted }))
      .catch(() => {
        checkedFor = null;
      });
  }, [userId, updateUser]);

  useEffect(() => {
    if (!open) return undefined;
    buttonRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await acceptTerms(LEGAL_VERSION);
      updateUser({ termsAccepted: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-6">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="terms-gate-title"
        aria-describedby="terms-gate-text"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-canvas px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 text-ink shadow-2xl ring-1 ring-ink/10 md:rounded-3xl md:px-6 md:pb-6"
      >
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
          <FileText className="size-5" />
        </span>
        <h2 id="terms-gate-title" className="mt-4 text-lg font-semibold tracking-tight">
          Publicamos nuestros términos y la política de privacidad
        </h2>
        <p id="terms-gate-text" className="mt-2 text-ink/70">
          Explican qué hace FinTrack con tus datos, con qué servicios los procesamos y cómo pedir que los veamos,
          corrijamos o borremos. Para seguir usando la app necesitamos que los aceptes.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link to="/terminos" target="_blank" rel="noopener" className="font-medium text-brand underline-offset-4 hover:underline">
              Leer los términos de uso
            </Link>
          </li>
          <li>
            <Link to="/privacidad" target="_blank" rel="noopener" className="font-medium text-brand underline-offset-4 hover:underline">
              Leer la política de privacidad
            </Link>
          </li>
        </ul>
        {error && (
          <p role="alert" className="mt-4 text-sm text-negative">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button ref={buttonRef} size="lg" onClick={accept} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            Acepto los términos y la política
          </Button>
          <Button size="lg" variant="ghost" onClick={signOut} disabled={busy}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
