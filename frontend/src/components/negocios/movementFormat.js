/**
 * Textos de los movimientos y el panel del negocio (FT-0017).
 */

/** Tipos de movimiento: nombre, si entra plata y la categoría que se propone. */
export const MOVEMENT_KINDS = {
  sale: { label: 'Venta', income: true, category: 'ventas', hint: 'Lo que vendiste' },
  cost: { label: 'Costo de venta', income: false, category: 'insumos', hint: 'Lo que cuesta hacer lo que vendes' },
  variable: { label: 'Gasto variable', income: false, category: 'otros', hint: 'Cambia según cuánto vendes' },
  fixed: { label: 'Gasto fijo', income: false, category: 'arriendo', hint: 'Se paga igual aunque no vendas' },
  otherIncome: { label: 'Otro ingreso', income: true, category: 'otros', hint: 'Plata que no viene de vender' },
};

export const KIND_OPTIONS = Object.entries(MOVEMENT_KINDS).map(([value, { label }]) => ({ value, label }));

/** Categorías del negocio. */
export const BUSINESS_CATEGORIES = {
  ventas: 'Ventas',
  insumos: 'Insumos',
  arriendo: 'Arriendo',
  nomina: 'Nómina',
  servicios: 'Servicios',
  publicidad: 'Publicidad',
  transporte: 'Transporte',
  impuestos: 'Impuestos',
  otros: 'Otros',
};

export const CATEGORY_OPTIONS = Object.entries(BUSINESS_CATEGORIES).map(([value, label]) => ({ value, label }));

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * @param {string} month AAAA-MM.
 * @param {string} [current] Mes actual AAAA-MM: si es del mismo año, no se muestra el año.
 * @returns {string} p. ej. `noviembre` o `diciembre 2025`.
 */
export function monthLabel(month, current) {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return current && current.slice(0, 4) === String(y) ? name : `${name} ${y}`;
}

/**
 * @param {string} month AAAA-MM.
 * @param {number} delta Meses a sumar (negativo para atrás).
 * @returns {string} AAAA-MM.
 */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Cambio frente al mes anterior en palabras.
 * @param {number|null} change Porcentaje.
 * @returns {string|null} p. ej. `+12 % que octubre`.
 */
export function changeText(change, previousLabel) {
  if (change === null || change === undefined) return null;
  if (change === 0) return `Igual que ${previousLabel}`;
  const sign = change > 0 ? '+' : '−';
  return `${sign}${Math.abs(change).toLocaleString('es-CO', { maximumFractionDigits: 1 })} % que ${previousLabel}`;
}
