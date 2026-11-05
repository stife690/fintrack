import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import CheckInbox from '@/components/auth/CheckInbox';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordRules from '@/components/auth/PasswordRules';
import SocialAuth from '@/components/auth/SocialAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getReturnTo, invitationKind } from '@/auth/returnTo';
import usePageTitle from '@/hooks/usePageTitle';
import { registerSchema } from '@/lib/validation/auth';
import { register as registerUser, resendVerification } from '@/services/authService';

/**
 * Pantalla de registro. Valida en el cliente (zod) y muestra los requisitos de la contraseña en
 * vivo. Al crear la cuenta no entra: muestra "Confirma tu correo" con reenvío, porque la API no da
 * sesión hasta abrir el enlace que llega al correo (FT-0016).
 */
export default function Register() {
  usePageTitle('Crear cuenta');
  const location = useLocation();
  const invitation = invitationKind(getReturnTo(location.state?.from));
  const [serverError, setServerError] = useState('');
  const [sentTo, setSentTo] = useState(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = async ({ confirmPassword: _confirm, acceptTerms: _terms, ...data }) => {
    setServerError('');
    try {
      const { email } = await registerUser(data);
      setSentTo(email);
    } catch (err) {
      setServerError(err.message || 'No pudimos crear tu cuenta. Inténtalo de nuevo.');
    }
  };

  if (sentTo) {
    return (
      <CheckInbox
        title="Confirma tu correo"
        subtitle={
          <>
            Te enviamos un enlace a <strong className="font-medium text-white">{sentTo}</strong>. Ábrelo
            para activar tu cuenta y entrar.
          </>
        }
        tips={[
          'El enlace vence en 24 horas y sirve una sola vez.',
          '¿No lo ves? Revisa las carpetas de spam o promociones.',
        ]}
        onResend={() => resendVerification(sentTo)}
        onChangeEmail={() => setSentTo(null)}
        footer={
          <Link
            to="/login"
            state={{ email: sentTo, from: location.state?.from }}
            className="font-medium text-violet-light transition-colors hover:text-white"
          >
            Ya lo confirmé, iniciar sesión
          </Link>
        }
      />
    );
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Empieza a registrar tus gastos en menos de un minuto."
      footer={
        <>
          <span className="text-white/55">¿Ya tienes cuenta? </span>
          <Link
            to="/login"
            state={location.state?.from ? { from: location.state.from } : undefined}
            className="font-medium text-violet-light transition-colors hover:text-white"
          >
            Inicia sesión
          </Link>
        </>
      }
    >
      {invitation && (
        <p className="rounded-xl bg-violet/15 px-4 py-3 text-sm text-violet-light" role="status">
          Te invitaron a {invitation === 'vaca' ? 'una vaca' : 'un negocio'}. Al crear tu cuenta e iniciar sesión te llevamos a la invitación.
        </p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" {...register('email')} />
          </FormField>

          <div className="space-y-3">
            <FormField id="password" label="Contraseña" error={errors.password?.message}>
              <PasswordInput autoComplete="new-password" placeholder="Crea una contraseña" {...register('password')} />
            </FormField>
            <PasswordRules password={password} />
          </div>

          <FormField id="confirmPassword" label="Confirmar contraseña" error={errors.confirmPassword?.message}>
            <PasswordInput autoComplete="new-password" placeholder="Repite tu contraseña" {...register('confirmPassword')} />
          </FormField>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Controller
              name="acceptTerms"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={errors.acceptTerms ? true : undefined}
                  aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
                />
              )}
            />
            <Label htmlFor="acceptTerms" className="leading-snug text-white/55">
              Acepto los términos de uso y la política de privacidad de FinTrack.
            </Label>
          </div>
          {errors.acceptTerms && (
            <p id="acceptTerms-error" className="text-sm text-destructive">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>

      <SocialAuth mode="register" />
    </AuthLayout>
  );
}
