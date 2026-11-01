import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { businessSchema } from '@/lib/validation/negocio';

/**
 * @param {import('@/services/negocioService').Business|null} initial
 * @returns {{ name: string, description: string, nit: string }}
 */
function toDefaults(initial) {
  return {
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    nit: initial?.nit ?? '',
  };
}

/**
 * Formulario para crear un negocio o editar el existente (FT-0016): nombre, a qué se dedica y NIT.
 *
 * @param {object} props
 * @param {import('@/services/negocioService').Business|null} [props.initial] Negocio a editar.
 * @param {boolean} [props.disabled] Sin conexión.
 * @param {(values: { name: string, description: string|null, nit: string|null }) => Promise<void>} props.onSubmit
 *   Debe lanzar un `Error` si falla; con `err.fields` se marcan los campos del servidor.
 * @param {() => void} [props.onCancel]
 */
export default function NegocioForm({ initial = null, disabled = false, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(businessSchema), defaultValues: toDefaults(initial) });

  useEffect(() => {
    reset(toDefaults(initial));
    setServerError('');
  }, [initial, reset]);

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({
        name: values.name,
        description: values.description || null,
        nit: values.nit || null,
      });
      if (!initial) reset(toDefaults(null));
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in toDefaults(null)) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label={initial ? 'Editar negocio' : 'Nuevo negocio'}>
      <FormField id="negocio-name" label="Nombre" error={errors.name?.message}>
        <Input placeholder="Ej. Arepas Doña Rosa" maxLength={60} disabled={disabled} {...register('name')} />
      </FormField>

      <FormField id="negocio-description" label="¿A qué se dedica? (opcional)" error={errors.description?.message}>
        <Input placeholder="Ej. Venta de arepas y jugos" maxLength={200} disabled={disabled} {...register('description')} />
      </FormField>

      <FormField id="negocio-nit" label="NIT o documento (opcional)" error={errors.nit?.message}>
        <Input placeholder="Ej. 900.123.456-7" inputMode="numeric" maxLength={20} disabled={disabled} {...register('nit')} />
      </FormField>

      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear negocio'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
