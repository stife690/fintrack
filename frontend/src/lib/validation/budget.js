import { z } from 'zod';

/**
 * Formulario de presupuesto. Sigue el contrato de `POST /budgets`: categoría de gasto y
 * límite mayor que 0. El mes no se pide: es el que se está viendo en la pantalla.
 */
export const budgetSchema = z.object({
  category: z.string().min(1, 'Elige una categoría'),
  amount: z.coerce
    .number({ error: 'Ingresa un monto válido' })
    .positive('El límite debe ser mayor que 0')
    .max(9_999_999_999.99, 'El monto es demasiado grande'),
});
