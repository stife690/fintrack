import { useMemo } from 'react';
import useAsync from '@/hooks/useAsync';
import { getCategories } from '@/services/transactionService';

/**
 * Categorías del usuario y su nombre por clave (`{ alimentacion: 'Alimentación' }`). Mientras cargan,
 * o si fallan, los nombres quedan vacíos y las listas muestran la clave.
 * @returns {{ categories: { expense: object[], income: object[] }|undefined, names: Record<string, string> }}
 */
export default function useCategoryNames() {
  const { data } = useAsync(getCategories, []);
  const names = useMemo(
    () => Object.fromEntries(data ? [...data.expense, ...data.income].map((c) => [c.key, c.name]) : []),
    [data],
  );
  return { categories: data, names };
}
