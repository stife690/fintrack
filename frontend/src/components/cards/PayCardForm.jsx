import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { payCardSchema } from '@/lib/validation/card';
import { todayIso } from '@/components/vacas/vacaFormat';

/**
 * Formulario "Ya pagué": el monto viene sugerido (total del extracto o lo usado) y la fecha es hoy.
 * @param {{ suggested: number, disabled?: boolean, onSubmit: (v: { amount: number, date: string }) => Promise<void>, onCancel?: () => void }} props
 */
export default function PayCardForm({ suggested, disabled = false, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(payCardSchema), defaultValues: { amount: String(suggested), date: todayIso() } });

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit(values);
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field === 'amount' || field === 'date') setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Ya pagué">
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <FormField id="pay-amount" label="Monto pagado (COP)" error={errors.amount?.message}>
            <MoneyInput name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} placeholder="0" disabled={disabled} />
          </FormField>
        )}
      />
      <FormField id="pay-date" label="Fecha del pago" error={errors.date?.message}>
        <Input type="date" max={todayIso()} disabled={disabled} {...register('date')} />
      </FormField>
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Guardando…' : 'Registrar pago'}
      </Button>
    </form>
  );
}
