import { z } from 'zod';

/** Fecha de hoy en la zona horaria del dispositivo, como AAAA-MM-DD. */
export function today() {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Formulario de transacción. Sigue el contrato de `POST /transactions`:
 * monto mayor que 0 (REQ-007), descripción de hasta 200 caracteres y fecha AAAA-MM-DD.
 * `category` vacío significa "que la IA la sugiera".
 */
export const transactionSchema = z.object({
  type: z.enum(['gasto', 'ingreso']),
  amount: z.coerce
    .number({ error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que 0')
    .max(9_999_999_999.99, 'El monto es demasiado grande'),
  description: z
    .string()
    .trim()
    .min(1, 'Escribe una descripción')
    .max(200, 'Usa máximo 200 caracteres'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha'),
  category: z.string(),
});
