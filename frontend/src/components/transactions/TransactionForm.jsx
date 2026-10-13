import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { today, transactionSchema } from '@/lib/validation/transaction';

const TYPES = [
  { value: 'gasto', label: 'Gasto' },
  { value: 'ingreso', label: 'Ingreso' },
];

/**
 * Valores iniciales del formulario: los de la transacción que se edita, o los de una nueva.
 * @param {import('@/services/transactionService').Transaction|null} initial
 * @returns {{ type: string, amount: string, description: string, date: string, category: string }}
 */
function toDefaults(initial) {
  return {
    type: initial?.type ?? 'gasto',
    amount: initial ? String(initial.amount) : '',
    description: initial?.description ?? '',
    date: initial?.date ?? today(),
    category: initial?.category ?? '',
  };
}

/**
 * Formulario para registrar o editar una transacción (monto, descripción, tipo, categoría, fecha).
 * Si se deja la categoría en "Que la IA la sugiera", la API la categoriza al guardar.
 *
 * @param {object} props
 * @param {{ expense: import('@/services/transactionService').Category[], income: import('@/services/transactionService').Category[] }} props.categories Catálogo por tipo.
 * @param {import('@/services/transactionService').Transaction|null} [props.initial] Transacción a editar; `null` para una nueva.
 * @param {(values: { type: string, amount: number, description: string, date: string, category: string|null }) => Promise<void>} props.onSubmit
 *   Debe lanzar un `Error` si falla; con `err.fields` se marcan los campos del servidor.
 * @param {() => void} [props.onCancel] Si se pasa, se muestra el botón "Cancelar".
 */
export default function TransactionForm({ categories, initial = null, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(transactionSchema), defaultValues: toDefaults(initial) });

  // Al cambiar de transacción a editar (o volver a "nueva") se recargan los valores.
  useEffect(() => {
    reset(toDefaults(initial));
    setServerError('');
  }, [initial, reset]);

  const type = watch('type');
  const options = type === 'gasto' ? categories.expense : categories.income;

  const pickType = (value) => {
    setValue('type', value, { shouldDirty: true });
    setValue('category', '', { shouldDirty: true }); // la categoría anterior era del otro tipo
  };

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({ ...values, category: values.category || null });
      if (!initial) reset(toDefaults(null));
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in toDefaults(null)) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label="Formulario de transacción">
      <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
        {TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={type === value}
            onClick={() => pickType(value)}
            className={cn(
              'h-11 rounded-xl border text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
              type === value
                ? 'border-primary bg-primary/15 text-white'
                : 'border-white/15 text-white/60 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" {...register('type')} />

      <FormField id="tx-amount" label="Monto (COP)" error={errors.amount?.message}>
        <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" {...register('amount')} />
      </FormField>

      <FormField id="tx-description" label="Descripción" error={errors.description?.message}>
        <Input maxLength={200} placeholder="Ej.: almuerzo en el restaurante" {...register('description')} />
      </FormField>

      <FormField id="tx-date" label="Fecha" error={errors.date?.message}>
        <Input type="date" {...register('date')} />
      </FormField>

      <FormField id="tx-category" label="Categoría" error={errors.category?.message}>
        <Select {...register('category')}>
          <option value="">Que la IA la sugiera</option>
          {options.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>
      {!watch('category') && (
        <p className="-mt-3 flex items-center gap-1.5 text-sm text-white/50">
          <Sparkles className="size-4 text-violet-light" aria-hidden="true" />
          Si no eliges una, la clasificamos por ti al guardar.
        </p>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Registrar'}
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
