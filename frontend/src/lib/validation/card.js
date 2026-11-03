import { z } from 'zod';
import { TIERS } from '@/lib/cardStyles';

const MAX_AMOUNT = 9_999_999_999.99;
// '' se rechaza antes de convertir: z.coerce.number() lo volvería 0.
const filled = (msg) => z.string().trim().min(1, msg);
const money = (positiveMsg) =>
  filled('Ingresa un monto').pipe(z.coerce.number({ error: 'Ingresa un monto válido' }).positive(positiveMsg).max(MAX_AMOUNT, 'El monto es demasiado grande'));
const day = filled('Ingresa un día').pipe(z.coerce.number({ error: 'Ingresa un día' }).int('Ingresa un día').min(1, 'Del 1 al 31').max(31, 'Del 1 al 31'));

const base = z.object({
  network: z.enum(Object.keys(TIERS)),
  tier: z.string(),
  last4: z.string().regex(/^\d{4}$/, 'Escribe exactamente 4 dígitos'),
  name: z.string().trim().max(40, 'Máximo 40 caracteres'),
  limit: money('El cupo debe ser mayor que 0'),
  paymentDay: day,
  cutoffDay: z.union([z.literal(''), day]),
});

const tierMatchesNetwork = (v) => TIERS[v.network]?.includes(v.tier);
const TIER_ISSUE = { message: 'Elige un tipo de tarjeta', path: ['tier'] };

/** Crear tarjeta: el disponible de hoy no puede pasar del cupo (el backend calcula lo usado). */
export const cardSchema = base
  .extend({ available: filled('Ingresa un monto').pipe(z.coerce.number({ error: 'Ingresa un monto válido' }).min(0, 'No puede ser negativo').max(MAX_AMOUNT, 'El monto es demasiado grande')) })
  .refine(tierMatchesNetwork, TIER_ISSUE)
  .refine((v) => v.available <= v.limit, { message: 'No puede ser mayor que el cupo total', path: ['available'] });

/** Editar tarjeta: sin disponible (la deuda solo cambia con pagos o al actualizar con el banco). */
export const cardEditSchema = base.refine(tierMatchesNetwork, TIER_ISSUE);
