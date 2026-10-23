import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Link2Off, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordRules from '@/components/auth/PasswordRules';
import { Button } from '@/components/ui/button';
import usePageTitle from '@/hooks/usePageTitle';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { resetPassword } from '@/services/authService';

/**
 * Pantalla del enlace del correo (`/restablecer#token=…`): pide la contraseña nueva y, al
 * guardarla, lleva al login. El token viene después de "#", que el navegador nunca envía al
 * servidor; al leerlo se borra de la barra de direcciones para que no quede en el historial.
 */
export default function ResetPassword() {
  usePageTitle('Nueva contraseña');
  const location = useLocation();
  const navigate = useNavigate();
  // Se lee una sola vez, antes de limpiar la dirección.
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token'));
  const [expired, setExpired] = useState(!token);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = async ({ password: newPassword }) => {
    setServerError('');
    try {
      await resetPassword({ token, password: newPassword });
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      if (err.code === 'INVALID_RESET_TOKEN') setExpired(true);
      else setServerError(err.message);
    }
  };

  if (expired) {
    return (
      <AuthLayout
        icon={Link2Off}
        title="Este enlace ya no sirve"
        subtitle="Los enlaces vencen a los 30 minutos y sirven una sola vez. Pide uno nuevo y usa el último que te llegue."
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/recuperar">Pedir un enlace nuevo</Link>
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="font-medium text-violet-light transition-colors hover:text-white">
            Volver a iniciar sesión
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={KeyRound}
      title="Crea una nueva contraseña"
      subtitle="Al guardarla se cerrará tu sesión en los demás dispositivos."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-3">
            <FormField id="password" label="Contraseña nueva" error={errors.password?.message}>
              <PasswordInput autoComplete="new-password" placeholder="••••••••" autoFocus {...register('password')} />
            </FormField>
            <PasswordRules password={password} />
          </div>
          <FormField id="confirmPassword" label="Confirmar contraseña" error={errors.confirmPassword?.message}>
            <PasswordInput autoComplete="new-password" placeholder="Repite tu contraseña" {...register('confirmPassword')} />
          </FormField>
        </div>

        {serverError && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthLayout>
  );
}
