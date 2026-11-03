import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Link2Off, Loader2, MailCheck, WifiOff } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import usePageTitle from '@/hooks/usePageTitle';
import { useAuth } from '@/auth/AuthContext';

const backToLogin = (
  <Link to="/login" className="font-medium text-violet-light transition-colors hover:text-white">
    Volver a iniciar sesión
  </Link>
);

/**
 * Pantalla del enlace para confirmar el correo (`/verificar#token=…`, FT-0016). Confirma el correo
 * apenas abre y entra a la app con la sesión que devuelve la API. El token viene después de "#",
 * que el navegador nunca envía al servidor; al leerlo se borra de la barra de direcciones.
 */
export default function VerifyEmail() {
  usePageTitle('Confirmar correo');
  const location = useLocation();
  const navigate = useNavigate();
  const { confirmEmail } = useAuth();
  // Se lee una sola vez, antes de limpiar la dirección.
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token'));
  const [status, setStatus] = useState(token ? 'verifying' : 'expired');
  const [error, setError] = useState('');
  // En desarrollo React ejecuta los efectos dos veces: el segundo envío encontraría el enlace ya
  // usado y mostraría "venció". Con esto el token se envía una sola vez por intento.
  const sent = useRef(false);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const verify = useCallback(async () => {
    setStatus('verifying');
    try {
      await confirmEmail(token);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err.code === 'INVALID_VERIFICATION_TOKEN') {
        setStatus('expired');
      } else {
        setError(err.message);
        setStatus('error');
      }
    }
  }, [confirmEmail, navigate, token]);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    verify();
  }, [token, verify]);

  if (status === 'expired') {
    return (
      <AuthLayout
        icon={Link2Off}
        title="Este enlace ya no sirve"
        subtitle="Los enlaces vencen a las 24 horas y sirven una sola vez. Inicia sesión con tu correo y contraseña y te ofrecemos uno nuevo."
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/login">Iniciar sesión</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (status === 'error') {
    return (
      <AuthLayout icon={WifiOff} title="No pudimos confirmar tu correo" subtitle={error} footer={backToLogin}>
        <Button type="button" size="lg" className="w-full" onClick={verify}>
          Reintentar
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={MailCheck} title="Confirmando tu correo" subtitle="Un momento, ya casi entras.">
      <p className="flex justify-center" role="status" aria-label="Confirmando tu correo">
        <Loader2 className="size-6 animate-spin text-violet-light" aria-hidden="true" />
      </p>
    </AuthLayout>
  );
}
