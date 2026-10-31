import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { getReturnTo } from '@/auth/returnTo';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '@/lib/google';

/** Logo oficial de Google en SVG. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

/** Ancho máximo que acepta el botón de Google (px). */
const MAX_BUTTON_WIDTH = 400;

/**
 * Separador "o" + botón "Continuar con Google" (login y registro).
 * Con `VITE_GOOGLE_CLIENT_ID` muestra el botón oficial de Google Identity Services: al elegir una
 * cuenta, Google entrega un `credential` y se inicia sesión con `signInWithGoogle` (si el correo
 * es nuevo, la cuenta se crea). Sin esa variable se deja el botón deshabilitado con "Próximamente".
 */
export default function SocialAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const buttonRef = useRef(null);
  const [status, setStatus] = useState(GOOGLE_CLIENT_ID ? 'loading' : 'off'); // loading | ready | failed | off
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  // Siempre llama a la versión más reciente (la callback de Google se registra una sola vez).
  const onCredential = useRef(null);
  onCredential.current = async ({ credential }) => {
    setError('');
    setSigningIn(true);
    try {
      await signInWithGoogle(credential);
      navigate(getReturnTo(location.state?.from), { replace: true });
    } catch (err) {
      setError(err.message || 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.');
      setSigningIn(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential.current(response),
          ux_mode: 'popup',
        });
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          locale: 'es',
          width: Math.min(buttonRef.current.clientWidth || MAX_BUTTON_WIDTH, MAX_BUTTON_WIDTH),
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-white/55">o</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {status === 'off' ? (
        <Button type="button" variant="outline" size="lg" className="w-full text-base" disabled aria-describedby="google-soon">
          <GoogleIcon />
          Continuar con Google
          <span id="google-soon" className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
            Próximamente
          </span>
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="relative flex min-h-11 w-full justify-center">
            <div
              ref={buttonRef}
              className={signingIn ? 'pointer-events-none w-full opacity-50' : 'w-full'}
              aria-hidden={status !== 'ready'}
            />
            {status === 'loading' && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/55">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Cargando Google…
              </span>
            )}
          </div>
          {signingIn && (
            <p role="status" className="flex items-center justify-center gap-2 text-sm text-white/65">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Entrando con Google…
            </p>
          )}
          <p className="text-center text-xs text-white/55">
            Al continuar con Google aceptas los términos de uso y la política de privacidad.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
