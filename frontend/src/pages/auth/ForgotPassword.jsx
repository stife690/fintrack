import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, MailCheck } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import FormField from '@/components/auth/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import usePageTitle from '@/hooks/usePageTitle';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { requestPasswordReset } from '@/services/authService';

/** Segundos de espera antes de poder reenviar el enlace. */
const RESEND_SECONDS = 60;

const backToLogin = (
  <Link to="/login" className="font-medium text-violet-light transition-colors hover:text-white">
    Volver a iniciar sesión
  </Link>
);

/**
 * "¿Olvidaste tu contraseña?" (`/recuperar`). Dos estados: el formulario del correo y, al enviarlo,
 * "Revisa tu correo" con reenvío tras 60 s. La API responde lo mismo exista o no la cuenta, así que
 * la pantalla tampoco lo afirma: dice "si tiene cuenta, te llegará".
 */
export default function ForgotPassword() {
  usePageTitle('Recuperar contraseña');
  const location = useLocation();
  const [sentTo, setSentTo] = useState(null);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    // Si viene del login con el correo escrito, no hay que volver a escribirlo.
    defaultValues: { email: location.state?.email ?? '' },
  });

  const onSubmit = async ({ email }) => {
    setServerError('');
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <>
      {/* Anuncia el cambio de estado a los lectores de pantalla (la pantalla se reemplaza entera). */}
      <p className="sr-only" role="status">
        {sentTo ? `Te enviamos un enlace a ${sentTo} si tiene una cuenta.` : ''}
      </p>
      {sentTo ? (
        <CheckInbox key="sent" email={sentTo} onChangeEmail={() => setSentTo(null)} />
      ) : (
        <AuthLayout
          key="form"
          icon={Mail}
          title="Recupera tu contraseña"
          subtitle="Escribe tu correo y te enviamos un enlace para crear una nueva."
          footer={backToLogin}
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
            <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="tu@correo.com"
                autoFocus
                {...register('email')}
              />
            </FormField>

            {serverError && (
              <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        </AuthLayout>
      )}
    </>
  );
}

/**
 * Estado "Revisa tu correo": a dónde se envió, cuánto dura el enlace, reenvío con cuenta regresiva
 * y la opción de corregir el correo.
 * @param {{ email: string, onChangeEmail: () => void }} props
 */
function CheckInbox({ email, onChangeEmail }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState('');

  // Un solo intervalo mientras quede tiempo; se limpia al llegar a 0 o al salir de la pantalla.
  const counting = secondsLeft > 0;
  useEffect(() => {
    if (!counting) return undefined;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [counting]);

  const resend = async () => {
    setResending(true);
    setNotice('');
    try {
      await requestPasswordReset(email);
      setNotice('Te enviamos un enlace nuevo. El anterior ya no sirve.');
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      icon={MailCheck}
      title="Revisa tu correo"
      subtitle={
        <>
          Si <strong className="font-medium text-white">{email}</strong> tiene una cuenta, te llegará un
          enlace para crear una contraseña nueva.
        </>
      }
      footer={backToLogin}
    >
      <ul className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
        <li>El enlace vence en 30 minutos y sirve una sola vez.</li>
        <li>¿No lo ves? Revisa las carpetas de spam o promociones.</li>
      </ul>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full border-white/15 text-white hover:bg-white/5"
          disabled={counting || resending}
          onClick={resend}
        >
          {resending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {counting ? (
            <>
              Reenviar enlace en{' '}
              <span className="tabular-nums">
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </>
          ) : (
            'Reenviar enlace'
          )}
        </Button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="w-full rounded-xl py-2 text-sm text-white/55 transition-colors hover:text-white"
        >
          Usar otro correo
        </button>
        {notice && (
          <p className="text-center text-sm text-white/65" role="status">
            {notice}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
