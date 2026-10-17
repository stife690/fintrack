import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { budgetSchema } from '@/lib/validation/budget';

/**
 * Valores iniciales: los del presupuesto que se edita, o vacíos para uno nuevo.
 * @param {import('@/services/budgetService').Budget|null} initial
 * @returns {{ category: string, amount: string }}
 */
function toDefaults(initial) {
  return {
    category: initial?.category ?? '',
    amount: initial ? String(initial.amount) : '',
  };
}

/**
 * Formulario para crear un presupuesto del mes que se está viendo, o cambiar el límite de uno
 * existente (la API no permite cambiar su categoría ni su mes).
 *
 * @param {object} props
 * @param {import('@/services/transactionService').Category[]} props.categories Categorías de gasto.
 * @param {string[]} props.usedCategories Claves que ya tienen presupuesto este mes (RN-03).
 * @param {string} props.monthLabel Mes legible, p. ej. `octubre de 2026`.
 * @param {import('@/services/budgetService').Budget|null} [props.initial] Presupuesto a editar.
 * @param {boolean} [props.disabled] Desactiva el formulario (p. ej. sin conexión).
 * @param {(values: { category: string, amount: number }) => Promise<void>} props.onSubmit
 *   Debe lanzar un `Error` si falla; con `err.fields` se marcan los campos del servidor.
 * @param {() => void} [props.onCancel] Si se pasa, se muestra el botón "Cancelar".
 */
export default function BudgetForm({
  categories,
  usedCategories,
  monthLabel,
  initial = null,
  disabled = false,
  onSubmit,
  onCancel,
}) {
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(budgetSchema), defaultValues: toDefaults(initial) });

  // Al elegir otro presupuesto para editar (o volver a "nuevo") se recargan los valores.
  useEffect(() => {
    reset(toDefaults(initial));
    setServerError('');
  }, [initial, reset]);

  const available = categories.filter((c) => !usedCategories.includes(c.key));
  const editingName = initial && categories.find((c) => c.key === initial.category)?.name;

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit(values);
      if (!initial) reset(toDefaults(null));
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in toDefaults(null)) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  if (!initial && available.length === 0 && categories.length > 0) {
    return (
      <p className="text-white/60">
        Todas tus categorías de gasto ya tienen presupuesto en {monthLabel}. Puedes cambiar sus
        límites desde la lista.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label="Formulario de presupuesto">
      {initial ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-white/80">Categoría</p>
          <p className="text-lg">{editingName ?? initial.category}</p>
        </div>
      ) : (
        <FormField id="budget-category" label="Categoría" error={errors.category?.message}>
          <Select disabled={disabled} {...register('category')}>
            <option value="">Elige una categoría de gasto</option>
            {available.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField id="budget-amount" label="Límite del mes (COP)" error={errors.amount?.message}>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0"
          disabled={disabled}
          {...register('amount')}
        />
      </FormField>

      <p className="-mt-2 text-sm text-white/50">
        {initial ? 'Aplica a ' : 'Se crea para '}
        {monthLabel}. Te avisamos al llegar al 80 % y al pasarte del 100 %.
      </p>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : initial ? 'Guardar límite' : 'Crear presupuesto'}
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
