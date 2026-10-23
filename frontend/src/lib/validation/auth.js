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

/** Contraseña nueva (registro y recuperación): 8+ caracteres con al menos una letra y un número. */
const newPassword = z
  .string()
  .min(8, 'Usa al menos 8 caracteres')
  .max(72, 'Usa máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Incluye al menos una letra')
  .regex(/\d/, 'Incluye al menos un número');

/** Error cuando las dos contraseñas no coinciden; se muestra debajo de `confirmPassword`. */
const PASSWORDS_MISMATCH = { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] };

/**
 * Formulario de registro. Sigue el contrato `POST /auth/register { email, password }`.
 */
export const registerSchema = z
  .object({
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
    acceptTerms: z.boolean().refine((v) => v, 'Debes aceptar los términos para continuar'),
  })
  .refine((data) => data.password === data.confirmPassword, PASSWORDS_MISMATCH);

/** Formulario "¿Olvidaste tu contraseña?": solo el correo. */
export const forgotPasswordSchema = z.object({ email });

/** Formulario de la contraseña nueva, al abrir el enlace del correo. */
export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, PASSWORDS_MISMATCH);
