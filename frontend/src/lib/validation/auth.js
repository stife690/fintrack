import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Ingresa tu correo electrónico')
  .pipe(z.email('Ingresa un correo válido'));

/** Formulario de inicio de sesión. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Ingresa tu contraseña'),
  remember: z.boolean(),
});

/**
 * Formulario de registro. Sigue el contrato `POST /auth/register { email, password }`;
 * contraseña de 8+ caracteres con al menos una letra y un número.
 */
export const registerSchema = z
  .object({
    email,
    password: z
      .string()
      .min(8, 'Usa al menos 8 caracteres')
      .max(72, 'Usa máximo 72 caracteres')
      .regex(/[A-Za-z]/, 'Incluye al menos una letra')
      .regex(/\d/, 'Incluye al menos un número'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
    acceptTerms: z.boolean().refine((v) => v, 'Debes aceptar los términos para continuar'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
