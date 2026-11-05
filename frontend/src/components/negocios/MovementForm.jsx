import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import MoneyInput from '@/components/common/MoneyInput';
import { CATEGORY_OPTIONS, KIND_OPTIONS, MOVEMENT_KINDS } from '@/components/negocios/movementFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { businessMovementSchema } from '@/lib/validation/businessMovement';

/**
 * Formulario para registrar un movimiento del negocio (FT-0017). Al cambiar el tipo se propone su
 * categoría (venta → Ventas, costo → Insumos…), que se puede cambiar.
 * @param {{ today: string, disabled?: boolean, onSubmit: (data: object) => Promise<void> }} props
 */
export default function MovementForm({ today, disabled = false, onSubmit }) {
  const [kind, setKind] = useState('sale');
  const [category, setCategory] = useState(MOVEMENT_KINDS.sale.category);
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(businessMovementSchema(today)),
    defaultValues: { amount: '', description: '', date: today },
  });

  const pickKind = (value) => {
    setKind(value);
    setCategory(MOVEMENT_KINDS[value].category);
  };

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({ kind, category, ...values, localId: crypto.randomUUID() });
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in values) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Registrar movimiento del negocio">
      <div>
        <ChipGroup legend="¿Qué fue?" options={KIND_OPTIONS} value={kind} onChange={pickKind} disabled={disabled} scroll />
        <p className="mt-1.5 text-sm text-ink/60">{MOVEMENT_KINDS[kind].hint}.</p>
      </div>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <FormField id="mov-amount" label="Monto (COP)" error={errors.amount?.message}>
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
      <FormField id="mov-description" label="Descripción" error={errors.description?.message}>
        <Input
          autoComplete="off"
          maxLength={120}
          placeholder={MOVEMENT_KINDS[kind].income ? 'Ej.: 20 arepas de queso' : 'Ej.: harina y queso'}
          disabled={disabled}
          {...register('description')}
        />
      </FormField>
      <ChipGroup
        legend="Categoría"
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={setCategory}
        disabled={disabled}
        scroll
      />
      <FormField id="mov-date" label="Fecha" error={errors.date?.message}>
        <Input type="date" max={today} disabled={disabled} {...register('date')} />
      </FormField>
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Guardando…' : `Registrar ${MOVEMENT_KINDS[kind].label.toLowerCase()}`}
      </Button>
    </form>
  );
}
