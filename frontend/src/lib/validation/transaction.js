import { z } from 'zod';

/** Fecha de hoy en la zona horaria del dispositivo, como AAAA-MM-DD. */
export function today() {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Formulario de transacción. Sigue el contrato de `POST /transactions`:
 * monto mayor que 0 (REQ-007), descripción de hasta 200 caracteres y fecha AAAA-MM-DD.
 * `category` vacío significa "que la IA la sugiera". `card` (id) e `installments` (1–48) van solo en un gasto con tarjeta.
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
  card: z.string().nullable(),
  // '' se deja pasar aquí (campo oculto sin tarjeta) y se exige abajo; así nunca se vuelve 0.
  installments: z.union([
    z.literal(''),
    z.string().trim().min(1).pipe(z.coerce.number({ error: 'Ingresa las cuotas' }).int('Ingresa las cuotas').min(1, 'De 1 a 48 cuotas').max(48, 'De 1 a 48 cuotas')),
  ]),
})
  .refine((v) => v.type !== 'gasto' || !v.card || v.installments !== '', { message: 'Ingresa las cuotas', path: ['installments'] })
  // Tarjeta y cuotas solo aplican a un gasto pagado con tarjeta.
  .transform((v) => {
    const carded = v.type === 'gasto' && Boolean(v.card);
    return { ...v, card: carded ? v.card : null, installments: carded ? v.installments : null };
  });
