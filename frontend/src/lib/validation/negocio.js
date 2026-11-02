import { z } from 'zod';

/**
 * Formulario para crear o editar un negocio (FT-0016). Sigue `POST /businesses`: nombre
 * obligatorio; descripción y NIT opcionales.
 */
export const businessSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al negocio').max(60, 'Máximo 60 caracteres'),
  description: z.string().trim().max(200, 'Máximo 200 caracteres'),
  nit: z
    .string()
    .trim()
    .max(20, 'Máximo 20 caracteres')
    .regex(/^([0-9][0-9.\- ]*)?$/, 'Solo números, puntos y guiones'),
});
