import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import SocialAuth from '@/components/auth/SocialAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { registerSchema } from '@/lib/validation/auth';
import { register as registerUser } from '@/services/authService';

/** Requisitos de contraseña, iguales a los de `registerSchema`. */
const PASSWORD_RULES = [
  { label: '8 caracteres o más', test: (v) => v.length >= 8 },
  { label: 'Una letra', test: (v) => /[A-Za-z]/.test(v) },
  { label: 'Un número', test: (v) => /\d/.test(v) },
];

/**
 * Pantalla de registro. Valida en el cliente (zod), muestra los requisitos de la
 * contraseña en vivo y, al crear la cuenta (simulado), redirige al login con el correo precargado.
 */
export default function Register() {
  usePageTitle('Crear cuenta');
  const navigate = useNavigate();
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
      navigate('/login', { state: { email: user.email, registered: true } });
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
          <Link to="/login" className="font-medium text-violet-light transition-colors hover:text-white">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" {...register('email')} />
          </FormField>

          <div className="space-y-3">
            <FormField id="password" label="Contraseña" error={errors.password?.message}>
              <PasswordInput autoComplete="new-password" placeholder="••••••••" {...register('password')} />
            </FormField>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Requisitos de la contraseña">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li
                    key={rule.label}
                    className={cn('inline-flex items-center gap-1 transition-colors', ok ? 'text-success' : 'text-white/40')}
                  >
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    {rule.label}
                    <span className="sr-only">{ok ? '(cumplido)' : '(pendiente)'}</span>
                  </li>
                );
              })}
            </ul>
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
