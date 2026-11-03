import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { bankSyncSchema } from '@/lib/validation/card';

const FIELDS = ['available', 'statementTotal', 'statementDueDate'];

/**
 * Formulario "Actualizar con el banco": se copian las cifras de la app del banco.
 * @param {{ disabled?: boolean, onSubmit: (v: { available: number, statementTotal?: number, statementDueDate?: string }) => Promise<void>, onCancel?: () => void }} props
 */
export default function BankSyncForm({ disabled = false, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(bankSyncSchema), defaultValues: { available: '', statementTotal: '', statementDueDate: '' } });

  const submit = handleSubmit(async (v) => {
    setServerError('');
    const data = { available: v.available };
    if (v.statementTotal !== '') data.statementTotal = v.statementTotal;
    if (v.statementDueDate) data.statementDueDate = v.statementDueDate;
    try {
      await onSubmit(data);
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (FIELDS.includes(field)) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  const money = (name, id, label) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormField id={id} label={label} error={errors[name]?.message}>
          <MoneyInput name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} placeholder="0" disabled={disabled} />
        </FormField>
      )}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Actualizar con el banco">
      <p className="text-sm text-ink/70">
        FinTrack no calcula intereses. Si el banco cobró de más, la diferencia queda como gasto «Cargos del banco» de la
        tarjeta (intereses, cuota de manejo u otros cargos).
      </p>
      {money('available', 'sync-available', 'Cupo disponible')}
      {money('statementTotal', 'sync-total', 'Total a pagar del extracto (opcional)')}
      <FormField id="sync-due" label="Fecha límite (opcional)" error={errors.statementDueDate?.message}>
        <Input type="date" disabled={disabled} {...register('statementDueDate')} />
      </FormField>
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Guardando…' : 'Actualizar'}
      </Button>
    </form>
  );
}
