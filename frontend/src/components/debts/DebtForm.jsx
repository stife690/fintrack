import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { debtSchema } from '@/lib/validation/debt';

const KIND_OPTIONS = [
  { value: 'receivable', label: 'Me deben' },
  { value: 'payable', label: 'Debo' },
];

/**
 * Formulario de una cuenta por cobrar o por pagar. Al crear se elige el lado; al editar no cambia.
 * @param {{ debt?: object, kind?: 'receivable'|'payable', disabled?: boolean, onSubmit: (v: object) => Promise<void> }} props
 */
export default function DebtForm({ debt, kind: initialKind = 'receivable', disabled = false, onSubmit }) {
  const editing = Boolean(debt);
  const [kind, setKind] = useState(debt?.kind ?? initialKind);
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      person: debt?.person ?? '',
      amount: debt ? String(debt.amount) : '',
      dueDate: debt?.dueDate ?? '',
      note: debt?.note ?? '',
    },
  });

  const submit = handleSubmit(async (values) => {
    setServerError('');
    const body = {
      ...values,
      dueDate: values.dueDate || null,
      note: values.note || null,
    };
    try {
      await onSubmit(editing ? body : { kind, ...body });
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in values) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  const receivable = kind === 'receivable';
  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label={editing ? 'Editar cuenta' : 'Nueva cuenta'}>
      {!editing && <ChipGroup legend="¿Quién debe?" options={KIND_OPTIONS} value={kind} onChange={setKind} disabled={disabled} />}
      <FormField id="debt-person" label={receivable ? '¿Quién te debe?' : '¿A quién le debes?'} error={errors.person?.message}>
        <Input autoComplete="off" placeholder="Nombre" maxLength={60} disabled={disabled} {...register('person')} />
      </FormField>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <FormField id="debt-amount" label="Monto (COP)" error={errors.amount?.message}>
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
      <FormField id="debt-due" label="Fecha límite (opcional)" error={errors.dueDate?.message}>
        <Input type="date" disabled={disabled} {...register('dueDate')} />
      </FormField>
      <FormField id="debt-note" label="Nota (opcional)" error={errors.note?.message}>
        <Input
          autoComplete="off"
          placeholder={receivable ? 'Ej.: le presté para el bus' : 'Ej.: el almuerzo del viernes'}
          maxLength={200}
          disabled={disabled}
          {...register('note')}
        />
      </FormField>
      <p className="text-sm text-ink/60">Un día antes de la fecha te llega un aviso. Esto no cambia lo que tienes en Mi plata.</p>
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar cuenta'}
      </Button>
    </form>
  );
}
