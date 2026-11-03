import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import SocialAuth from '@/components/auth/SocialAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePageTitle from '@/hooks/usePageTitle';
import { loginSchema } from '@/lib/validation/auth';
import { useAuth } from '@/auth/AuthContext';
import { getReturnTo, invitationKind } from '@/auth/returnTo';
import { resendVerification } from '@/services/authService';

/**
 * Pantalla de inicio de sesión. Valida en el cliente (zod), inicia la sesión con `signIn`
 * (AuthContext) y lleva a la página que el usuario pidió, o a `/app`.
 * Si viene del registro, precarga el correo. Si la cuenta aún no confirma el correo (FT-0016),
 * ofrece reenviar el enlace.
 */
export default function Login() {
  usePageTitle('Iniciar sesión');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [serverError, setServerError] = useState('');
  // Correo de la cuenta sin confirmar con el que se intentó entrar, y el aviso del reenvío.
  const [unverified, setUnverified] = useState(null);
  const [resendNotice, setResendNotice] = useState('');
  const invitation = invitationKind(getReturnTo(location.state?.from));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: location.state?.email ?? '', password: '', remember: false },
  });
  // El correo escrito pasa a "¿Olvidaste tu contraseña?" para no tener que escribirlo otra vez.
  const email = useWatch({ control, name: 'email' });

  const onSubmit = async (values) => {
    setServerError('');
    setUnverified(null);
    setResendNotice('');
    try {
      await signIn(values);
      navigate(getReturnTo(location.state?.from), { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(values.email);
      setServerError(err.message || 'No pudimos iniciar sesión. Inténtalo de nuevo.');
    }
  };

  const resend = async () => {
    setResendNotice('');
    try {
      await resendVerification(unverified);
      setResendNotice('Te enviamos un enlace nuevo. Revisa tu correo.');
    } catch (err) {
      setResendNotice(err.message);
    }
  };

  // Si ya hay sesión, no tiene sentido mostrar el formulario.
  if (user) {
    return <Navigate to={getReturnTo(location.state?.from)} replace />;
  }

  return (
    <AuthLayout
      title="Inicia sesión en tu cuenta"
      subtitle="Ingresa tus datos para continuar con tus finanzas."
      footer={
        <>
          <span className="text-white/55">¿No tienes cuenta? </span>
          <Link
            to="/registro"
            state={location.state?.from ? { from: location.state.from } : undefined}
            className="font-medium text-violet-light transition-colors hover:text-white"
          >
            Regístrate
          </Link>
        </>
      }
    >
      {invitation && (
        <p className="rounded-xl bg-violet/15 px-4 py-3 text-sm text-violet-light" role="status">
          Te invitaron a {invitation === 'vaca' ? 'una vaca' : 'un negocio'}. Inicia sesión o crea tu cuenta y te llevamos a la invitación.
        </p>
      )}
      {location.state?.passwordReset && (
        <p className="rounded-xl bg-mint/10 px-4 py-3 text-sm text-mint" role="status">
          Contraseña actualizada. Inicia sesión con la nueva.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" {...register('email')} />
          </FormField>
          <FormField id="password" label="Contraseña" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" placeholder="Tu contraseña" {...register('password')} />
          </FormField>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Controller
              name="remember"
              control={control}
              render={({ field }) => (
                <Checkbox id="remember" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              )}
            />
            <Label htmlFor="remember" className="text-white/55">
              Recordarme 30 días
            </Label>
          </div>
          <Link
            to="/recuperar"
            state={{ email }}
            className="text-sm text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {serverError && (
          <div className="space-y-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            <p>{serverError}</p>
            {unverified && (
              <button
                type="button"
                onClick={resend}
                className="font-medium text-white underline underline-offset-4 transition-colors hover:text-violet-light"
              >
                Reenviar enlace
              </button>
            )}
          </div>
        )}
        {resendNotice && (
          <p className="text-center text-sm text-white/65" role="status">
            {resendNotice}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
        </Button>

        <SocialAuth />
      </form>
    </AuthLayout>
  );
}
