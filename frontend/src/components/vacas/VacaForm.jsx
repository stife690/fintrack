import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { vacaSchema } from '@/lib/validation/vaca';
import { todayIso } from './vacaFormat';

const SPLIT_OPTIONS = [
  { value: 'igual', label: 'Partes iguales' },
  { value: 'personalizado', label: 'Cuotas a medida' },
];

/**
 * @param {import('@/services/vacaService').Vaca|null} initial
 * @returns {{ name: string, goal: string, description: string, deadline: string, split: 'igual'|'personalizado' }}
 */
function toDefaults(initial) {
  return {
    name: initial?.name ?? '',
    goal: initial ? String(initial.goal) : '',
    description: initial?.description ?? '',
    deadline: initial?.deadline ?? '',
    split: initial?.split ?? 'igual',
  };
}

/**
 * Formulario para crear una vaca o editar la existente (FT-0014): nombre, meta, fecha límite
 * opcional, para qué es y cómo se reparte entre los miembros.
 *
 * @param {object} props
 * @param {import('@/services/vacaService').Vaca|null} [props.initial] Vaca a editar.
 * @param {boolean} [props.disabled] Sin conexión.
 * @param {(values: { name: string, goal: number, description: string|null, deadline: string|null, split: string }) => Promise<void>} props.onSubmit
 *   Debe lanzar un `Error` si falla; con `err.fields` se marcan los campos del servidor.
 * @param {() => void} [props.onCancel]
 */
export default function VacaForm({ initial = null, disabled = false, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(vacaSchema), defaultValues: toDefaults(initial) });

  useEffect(() => {
    reset(toDefaults(initial));
    setServerError('');
  }, [initial, reset]);

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({
        name: values.name,
        goal: values.goal,
        description: values.description || null,
        deadline: values.deadline || null,
        split: values.split,
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
    <form onSubmit={submit} noValidate className="space-y-5" aria-label={initial ? 'Editar vaca' : 'Nueva vaca'}>
      <FormField id="vaca-name" label="Nombre" error={errors.name?.message}>
        <Input placeholder="Ej. Paseo de fin de año" maxLength={60} disabled={disabled} {...register('name')} />
      </FormField>

      <Controller
        control={control}
        name="goal"
        render={({ field }) => (
          <FormField id="vaca-goal" label="Meta (COP)" error={errors.goal?.message}>
            <MoneyInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder="0"
              disabled={disabled}
            />
          </FormField>
        )}
      />

      <FormField id="vaca-deadline" label="Fecha límite (opcional)" error={errors.deadline?.message}>
        <Input type="date" min={todayIso()} disabled={disabled} {...register('deadline')} />
      </FormField>

      <FormField id="vaca-description" label="¿Para qué es? (opcional)" error={errors.description?.message}>
        <Input placeholder="Ej. Hotel y transporte" maxLength={200} disabled={disabled} {...register('description')} />
      </FormField>

      <Controller
        control={control}
        name="split"
        render={({ field }) => (
          <ChipGroup
            legend="Cómo se reparte"
            options={SPLIT_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
          />
        )}
      />
      <p className="-mt-3 text-sm text-ink/60">
        Con partes iguales, a cada miembro le toca la meta dividida entre todos. Con cuotas a medida, un
        administrador pone la de cada uno y lo demás se reparte.
      </p>

      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear vaca'}
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
