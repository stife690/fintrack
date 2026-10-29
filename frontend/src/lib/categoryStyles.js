import {
  Baby,
  Beer,
  BookOpen,
  Briefcase,
  BriefcaseBusiness,
  Car,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  Heart,
  Music,
  PawPrint,
  Pizza,
  Plane,
  Scissors,
  ShoppingCart,
  Smartphone,
  Sparkles,
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
 * Íconos que puede elegir el usuario para una categoría propia. Las claves son las mismas que
 * acepta la API (`CATEGORY_ICONS` en el backend).
 */
export const ICON_OPTIONS = [
  { key: 'paw-print', icon: PawPrint, label: 'Mascota' },
  { key: 'dumbbell', icon: Dumbbell, label: 'Gimnasio' },
  { key: 'gift', icon: Gift, label: 'Regalo' },
  { key: 'plane', icon: Plane, label: 'Viaje' },
  { key: 'baby', icon: Baby, label: 'Bebé' },
  { key: 'car', icon: Car, label: 'Carro' },
  { key: 'fuel', icon: Fuel, label: 'Gasolina' },
  { key: 'coffee', icon: Coffee, label: 'Café' },
  { key: 'pizza', icon: Pizza, label: 'Comida' },
  { key: 'beer', icon: Beer, label: 'Salidas' },
  { key: 'gamepad', icon: Gamepad2, label: 'Juegos' },
  { key: 'music', icon: Music, label: 'Música' },
  { key: 'book', icon: BookOpen, label: 'Libros' },
  { key: 'shopping-cart', icon: ShoppingCart, label: 'Compras' },
  { key: 'heart', icon: Heart, label: 'Pareja' },
  { key: 'smartphone', icon: Smartphone, label: 'Celular' },
  { key: 'scissors', icon: Scissors, label: 'Belleza' },
  { key: 'briefcase', icon: Briefcase, label: 'Trabajo' },
  { key: 'piggy-bank', icon: PiggyBank, label: 'Ahorro' },
  { key: 'sparkles', icon: Sparkles, label: 'Otro' },
];

/** Colores que puede elegir el usuario (`CATEGORY_COLORS` en el backend). */
export const COLOR_OPTIONS = [
  { key: 'orange', label: 'Naranja', className: 'bg-orange-500/15 text-orange-500', swatch: 'bg-orange-500' },
  { key: 'sky', label: 'Celeste', className: 'bg-sky-500/15 text-sky-500', swatch: 'bg-sky-500' },
  { key: 'amber', label: 'Ámbar', className: 'bg-amber-500/15 text-amber-500', swatch: 'bg-amber-500' },
  { key: 'rose', label: 'Rosado', className: 'bg-rose-500/15 text-rose-500', swatch: 'bg-rose-500' },
  { key: 'teal', label: 'Verde azulado', className: 'bg-teal-500/15 text-teal-500', swatch: 'bg-teal-500' },
  { key: 'fuchsia', label: 'Fucsia', className: 'bg-fuchsia-500/15 text-fuchsia-500', swatch: 'bg-fuchsia-500' },
  { key: 'indigo', label: 'Índigo', className: 'bg-indigo-500/15 text-indigo-500', swatch: 'bg-indigo-500' },
  { key: 'emerald', label: 'Esmeralda', className: 'bg-emerald-500/15 text-emerald-500', swatch: 'bg-emerald-500' },
];

const ICON_BY_KEY = Object.fromEntries(ICON_OPTIONS.map((o) => [o.key, o.icon]));
const COLOR_BY_KEY = Object.fromEntries(COLOR_OPTIONS.map((o) => [o.key, o.className]));

/**
 * Estilo de una categoría propia a partir del ícono y el color que eligió el usuario.
 * @param {{ icon?: string|null, color?: string|null }} category
 * @returns {{ icon: import('lucide-react').LucideIcon, className: string }}
 */
export function customStyle({ icon, color }) {
  return {
    icon: ICON_BY_KEY[icon] ?? FALLBACK.icon,
    className: COLOR_BY_KEY[color] ?? FALLBACK.className,
  };
}

/** Estilos de las categorías propias del usuario, por clave (los llena `registerCategories`). */
const custom = new Map();

/**
 * Guarda el ícono y el color de las categorías propias para que `getCategoryStyle` las dibuje
 * en cualquier pantalla con solo la clave. Se llama cada vez que se cargan las categorías.
 * @param {Array<{ key: string, icon?: string|null, color?: string|null, custom?: boolean }>} categories
 * @returns {void}
 */
export function registerCategories(categories) {
  for (const category of categories) {
    if (category.custom) custom.set(category.key, customStyle(category));
  }
}

/**
 * @param {string|null|undefined} key Clave de la categoría.
 * @returns {{ icon: import('lucide-react').LucideIcon, className: string }}
 */
export function getCategoryStyle(key) {
  return (key && (STYLES[key] ?? custom.get(key))) || FALLBACK;
}
