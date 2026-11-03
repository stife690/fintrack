import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import CheckInbox from '@/components/auth/CheckInbox';
import FormField from '@/components/auth/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import usePageTitle from '@/hooks/usePageTitle';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { requestPasswordReset } from '@/services/authService';

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
        <CheckInbox
          key="sent"
          subtitle={
            <>
              Si <strong className="font-medium text-white">{sentTo}</strong> tiene una cuenta, te llegará un
              enlace para crear una contraseña nueva.
            </>
          }
          tips={[
            'El enlace vence en 30 minutos y sirve una sola vez.',
            '¿No lo ves? Revisa las carpetas de spam o promociones.',
          ]}
          onResend={() => requestPasswordReset(sentTo)}
          onChangeEmail={() => setSentTo(null)}
          footer={backToLogin}
        />
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
