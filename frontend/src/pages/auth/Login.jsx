import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
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
import { login } from '@/services/authService';

/**
 * Pantalla de inicio de sesión. Valida en el cliente (zod) y llama a `authService.login`,
 * que por ahora es simulado. Si viene del registro, precarga el correo.
 */
export default function Login() {
  usePageTitle('Iniciar sesión');
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [serverError, setServerError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: location.state?.email ?? '', password: '', remember: false },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const { user: loggedUser } = await login(values);
      setUser(loggedUser);
    } catch (err) {
      setServerError(err.message || 'No pudimos iniciar sesión. Inténtalo de nuevo.');
    }
  };

  if (user) {
    return (
      <AuthLayout title="¡Hola de nuevo!" subtitle={`Iniciaste sesión como ${user.email}.`}>
        <div className="space-y-6 rounded-3xl border border-white/10 bg-glass p-6 text-center" role="status">
          <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
          <p className="text-white/70">
            Este inicio de sesión es una simulación: la autenticación real se conectará cuando la API esté lista.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link to="/">Ir al inicio</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Inicia sesión en tu cuenta"
      subtitle="Ingresa tus datos para continuar con tus finanzas."
      footer={
        <>
          <span className="text-white/55">¿No tienes cuenta? </span>
          <Link to="/registro" className="font-medium text-violet-light transition-colors hover:text-white">
            Regístrate
          </Link>
        </>
      }
    >
      {location.state?.registered && (
        <p className="rounded-xl bg-mint/10 px-4 py-3 text-sm text-mint" role="status">
          Cuenta creada. Ya puedes iniciar sesión.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" {...register('email')} />
          </FormField>
          <FormField id="password" label="Contraseña" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" placeholder="••••••••" {...register('password')} />
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
          <span className="text-sm text-white/35" title="Próximamente">
            ¿Olvidaste tu contraseña?
          </span>
        </div>

        {serverError && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {serverError}
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
