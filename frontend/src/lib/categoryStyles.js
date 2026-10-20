import {
  BriefcaseBusiness,
  Bus,
  CircleHelp,
  Clapperboard,
  Coins,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  Lightbulb,
  PiggyBank,
  Shapes,
  Shirt,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

/**
 * Ícono y color de cada categoría del catálogo (`db/init/02_seed_categorias.sql`).
 * El color es un tinte suave de fondo + el ícono en el tono medio: se lee bien en claro y oscuro.
 * Las clases están escritas completas para que Tailwind las encuentre al compilar.
 */
const STYLES = {
  alimentacion: { icon: UtensilsCrossed, className: 'bg-orange-500/15 text-orange-500' },
  transporte: { icon: Bus, className: 'bg-sky-500/15 text-sky-500' },
  vivienda: { icon: House, className: 'bg-amber-500/15 text-amber-500' },
  servicios_publicos: { icon: Lightbulb, className: 'bg-yellow-500/15 text-yellow-600' },
  salud: { icon: HeartPulse, className: 'bg-rose-500/15 text-rose-500' },
  educacion: { icon: GraduationCap, className: 'bg-teal-500/15 text-teal-500' },
  entretenimiento: { icon: Clapperboard, className: 'bg-fuchsia-500/15 text-fuchsia-500' },
  ropa_accesorios: { icon: Shirt, className: 'bg-pink-500/15 text-pink-500' },
  tecnologia: { icon: Laptop, className: 'bg-indigo-500/15 text-indigo-500' },
  ahorro_inversion: { icon: PiggyBank, className: 'bg-emerald-500/15 text-emerald-500' },
  otros: { icon: Shapes, className: 'bg-slate-500/15 text-slate-500' },
  salario: { icon: Wallet, className: 'bg-emerald-500/15 text-emerald-500' },
  freelance: { icon: BriefcaseBusiness, className: 'bg-cyan-500/15 text-cyan-500' },
  inversion_rendimientos: { icon: TrendingUp, className: 'bg-lime-500/15 text-lime-600' },
  otros_ingresos: { icon: Coins, className: 'bg-green-500/15 text-green-500' },
};

/** Para transacciones sin clasificar o categorías nuevas que aún no tienen estilo. */
const FALLBACK = { icon: CircleHelp, className: 'bg-ink/10 text-ink/60' };

/**
 * @param {string|null|undefined} key Clave de la categoría.
 * @returns {{ icon: import('lucide-react').LucideIcon, className: string }}
 */
export function getCategoryStyle(key) {
  return (key && STYLES[key]) || FALLBACK;
}
