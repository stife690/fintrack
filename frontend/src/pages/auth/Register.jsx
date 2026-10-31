import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordRules from '@/components/auth/PasswordRules';
import SocialAuth from '@/components/auth/SocialAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getReturnTo, isInvitation } from '@/auth/returnTo';
import usePageTitle from '@/hooks/usePageTitle';
import { registerSchema } from '@/lib/validation/auth';
import { register as registerUser } from '@/services/authService';

/**
 * Pantalla de registro. Valida en el cliente (zod), muestra los requisitos de la
 * contraseña en vivo y, al crear la cuenta (simulado), redirige al login con el correo precargado.
 */
export default function Register() {
  usePageTitle('Crear cuenta');
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');

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
      const { user } = await registerUser(data);
      // `from`: quien llegó desde un enlace (p. ej. una invitación a una vaca) vuelve allí al entrar.
      navigate('/login', { state: { email: user.email, registered: true, from: location.state?.from } });
    } catch (err) {
      setServerError(err.message || 'No pudimos crear tu cuenta. Inténtalo de nuevo.');
    }
  };

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
      {isInvitation(getReturnTo(location.state?.from)) && (
        <p className="rounded-xl bg-violet/15 px-4 py-3 text-sm text-violet-light" role="status">
          Te invitaron a una vaca. Al crear tu cuenta e iniciar sesión te llevamos a la invitación.
        </p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" {...register('email')} />
          </FormField>

          <div className="space-y-3">
            <FormField id="password" label="Contraseña" error={errors.password?.message}>
              <PasswordInput autoComplete="new-password" placeholder="••••••••" {...register('password')} />
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

        <SocialAuth />
      </form>
    </AuthLayout>
  );
}
