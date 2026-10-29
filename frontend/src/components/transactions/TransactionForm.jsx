import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import CategoryPicker, { AUTO_CATEGORY } from '@/components/categories/CategoryPicker';
import DateQuickPick from '@/components/transactions/DateQuickPick';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/common/MoneyInput';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { today, transactionSchema } from '@/lib/validation/transaction';

const TYPES = [
  { value: 'gasto', label: 'Gasto' },
  { value: 'ingreso', label: 'Ingreso' },
];

/**
 * Valores iniciales del formulario: los de la transacción que se edita, o los de una nueva.
 * @param {import('@/services/transactionService').Transaction|null} initial
 * @param {'gasto'|'ingreso'} [defaultType] Tipo con el que empieza una transacción nueva.
 * @returns {{ type: string, amount: string, description: string, date: string, category: string }}
 */
function toDefaults(initial, defaultType = 'gasto') {
  return {
    type: initial?.type ?? defaultType,
    amount: initial ? String(initial.amount) : '',
    description: initial?.description ?? '',
    date: initial?.date ?? today(),
    category: initial?.category ?? AUTO_CATEGORY,
  };
}

/**
 * Formulario para registrar o editar una transacción (tipo, monto, descripción, fecha y categoría).
 * La fecha se elige con "Hoy / Ayer / Otra fecha" y la categoría en una cuadrícula con íconos.
 * Con "Sugerir con IA" la API la categoriza al guardar.
 *
 * @param {object} props
 * @param {{ expense: import('@/services/transactionService').Category[], income: import('@/services/transactionService').Category[] }} props.categories Catálogo por tipo.
 * @param {import('@/services/transactionService').Transaction|null} [props.initial] Transacción a editar; `null` para una nueva.
 * @param {(values: { type: string, amount: number, description: string, date: string, category: string|null }) => Promise<void>} props.onSubmit
 *   Debe lanzar un `Error` si falla; con `err.fields` se marcan los campos del servidor.
 * @param {() => void} [props.onCancel] Si se pasa, se muestra el botón "Cancelar".
 * @param {'gasto'|'ingreso'} [props.defaultType] Tipo inicial de una transacción nueva.
 * @param {boolean} [props.autoFocus] Pone el cursor en el monto al abrir (p. ej. desde un acceso rápido).
 * @param {{ type: 'gasto'|'ingreso', amount: number|null, description: string }|null} [props.draft]
 *   Lo dictado por voz (FT-0013): llena una transacción nueva para revisarla antes de guardar.
 *   Cada objeto nuevo vuelve a llenar el formulario.
 */
export default function TransactionForm({
  categories,
  initial = null,
  onSubmit,
  onCancel,
  defaultType = 'gasto',
  autoFocus = false,
  draft = null,
}) {
  const [serverError, setServerError] = useState('');
  // Cambia en cada reinicio del formulario para que la fecha vuelva a "Hoy".
  const [resetKey, setResetKey] = useState(0);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(transactionSchema), defaultValues: toDefaults(initial, defaultType) });

  // Al cambiar de transacción a editar (o volver a "nueva") se recargan los valores.
  useEffect(() => {
    reset(toDefaults(initial, defaultType));
    setServerError('');
    setResetKey((k) => k + 1);
  }, [initial, defaultType, reset]);

  // Referencia propia al monto (además de la de react-hook-form) para poner el cursor ahí
  // cuando se llega desde un acceso rápido.
  const amountRef = useRef(null);
  useEffect(() => {
    if (autoFocus) amountRef.current?.focus();
  }, [autoFocus, defaultType]);

  // Va después del reinicio de arriba para que, al abrir, gane lo dictado. Si no se entendió
  // el monto, el cursor queda ahí para escribirlo.
  useEffect(() => {
    if (!draft) return;
    reset({
      ...toDefaults(null, draft.type),
      amount: draft.amount === null ? '' : String(draft.amount),
      description: draft.description,
    });
    setServerError('');
    setResetKey((k) => k + 1);
    if (draft.amount === null) amountRef.current?.focus();
  }, [draft, reset]);

  const type = watch('type');
  const options = type === 'gasto' ? categories.expense : categories.income;

  const pickType = (value) => {
    setValue('type', value, { shouldDirty: true });
    setValue('category', AUTO_CATEGORY, { shouldDirty: true }); // la categoría anterior era del otro tipo
  };

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({ ...values, category: values.category || null });
      if (!initial) {
        reset(toDefaults(null, defaultType));
        setResetKey((k) => k + 1);
      }
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in toDefaults(null)) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label="Formulario de movimiento">
      <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
        {TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={type === value}
            onClick={() => pickType(value)}
            className={cn(
              'h-10 rounded-lg text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
              type === value ? 'bg-surface text-ink shadow-sm ring-1 ring-ink/10' : 'text-ink/60 hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" {...register('type')} />

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <FormField id="tx-amount" label="Monto (COP)" error={errors.amount?.message}>
            <MoneyInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="0"
              className="h-14 text-2xl font-semibold tabular-nums"
              ref={(el) => {
                field.ref(el);
                amountRef.current = el;
              }}
            />
          </FormField>
        )}
      />

      <FormField id="tx-description" label="Descripción" error={errors.description?.message}>
        <Input maxLength={200} placeholder="Almuerzo en el restaurante" {...register('description')} />
      </FormField>

      <Controller
        control={control}
        name="date"
        render={({ field }) => (
          <DateQuickPick key={resetKey} value={field.value} onChange={field.onChange} error={errors.date?.message} />
        )}
      />

      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <CategoryPicker
            legend="Categoría"
            categories={options}
            value={field.value}
            onChange={field.onChange}
            inputRef={field.ref}
            allowAuto
            error={errors.category?.message}
          />
        )}
      />
      {watch('category') === AUTO_CATEGORY && (
        <p className="-mt-3 flex items-center gap-1.5 text-sm text-ink/60">
          <Sparkles className="size-4 shrink-0 text-brand" aria-hidden="true" />
          La clasificamos por ti al guardar.
        </p>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : initial ? 'Guardar cambios' : type === 'ingreso' ? 'Guardar ingreso' : 'Guardar gasto'}
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
