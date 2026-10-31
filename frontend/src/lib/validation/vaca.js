import { z } from 'zod';

const MAX_AMOUNT = 9_999_999_999.99;

/**
 * Formulario para crear o editar una vaca (FT-0014). Sigue `POST /vacas`: nombre y meta
 * obligatorios; fecha límite, descripción y reparto opcionales.
 */
export const vacaSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre a la vaca').max(60, 'Máximo 60 caracteres'),
  goal: z.coerce
    .number({ error: 'Ingresa un monto válido' })
    .positive('La meta debe ser mayor que 0')
    .max(MAX_AMOUNT, 'El monto es demasiado grande'),
  description: z.string().trim().max(200, 'Máximo 200 caracteres'),
  deadline: z.string(),
  split: z.enum(['igual', 'personalizado']),
});

/** Formulario de un aporte: monto, fecha (no futura) y nota opcional. */
export const contributionSchema = z.object({
  amount: z.coerce
    .number({ error: 'Ingresa un monto válido' })
    .positive('El aporte debe ser mayor que 0')
    .max(MAX_AMOUNT, 'El monto es demasiado grande'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha'),
  note: z.string().trim().max(120, 'Máximo 120 caracteres'),
  category: z.string(),
});
