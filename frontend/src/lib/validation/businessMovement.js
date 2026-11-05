import { z } from 'zod';

const MAX_AMOUNT = 9_999_999_999.99;

/** Movimiento del negocio (FT-0017): monto y descripción obligatorios; la fecha, hasta hoy. */
export const businessMovementSchema = (today) =>
  z.object({
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
    description: z.string().trim().min(1, 'Escribe una descripción').max(120, 'Máximo 120 caracteres'),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha')
      .refine((d) => d <= today, 'No puede ser una fecha futura'),
  });
