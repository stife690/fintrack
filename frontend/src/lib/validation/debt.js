import { z } from 'zod';

const MAX_AMOUNT = 9_999_999_999.99;

/** Cuenta por cobrar o por pagar (FT-0046): persona y monto obligatorios; fecha y nota no. */
export const debtSchema = z.object({
  person: z.string().trim().min(1, 'Escribe el nombre').max(60, 'Máximo 60 caracteres'),
  // '' se rechaza antes de convertir: z.coerce.number() lo volvería 0.
  amount: z
    .string()
    .trim()
    .min(1, 'Ingresa un monto')
    .pipe(
      z.coerce
        .number({ error: 'Ingresa un monto válido' })
        .positive('El monto debe ser mayor que 0')
        .max(MAX_AMOUNT, 'El monto es demasiado grande'),
    ),
  dueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida'),
  note: z.string().trim().max(200, 'Máximo 200 caracteres'),
});
