/**
 * Periodos del dashboard (FT-0004): semana (lunes a domingo), mes y año.
 * Las fechas van en AAAA-MM-DD y se calculan con la hora local del dispositivo,
 * igual que el backend (que usa la hora de Colombia), para no saltar de día de noche.
 */

/** @typedef {'week'|'month'|'year'} Period */

/** Opciones del selector, en el orden en que se muestran. */
export const PERIOD_OPTIONS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

/**
 * @param {Date} date
 * @returns {string} La fecha local como AAAA-MM-DD.
 */
function toIso(date) {
  return date.toLocaleDateString('en-CA');
}

/**
 * @param {string} iso AAAA-MM-DD
 * @returns {Date} Esa fecha a las 00:00 locales.
 */
function fromIso(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** @returns {string} Hoy en AAAA-MM-DD. */
export function todayIso() {
  return toIso(new Date());
}

/**
 * Primer y último día del periodo que contiene `date`.
 * @param {Period} period
 * @param {string} date Cualquier día del periodo, AAAA-MM-DD.
 * @returns {{ from: string, to: string }}
 */
export function periodRange(period, date) {
  const d = fromIso(date);
  if (period === 'year') {
    return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
  }
  if (period === 'month') {
    // El día 0 del mes siguiente es el último día de este mes.
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: toIso(first), to: toIso(last) };
  }
  // getDay(): domingo = 0 ... sábado = 6. Se convierte para que lunes sea 0.
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toIso(monday), to: toIso(sunday) };
}

/**
 * Mueve la fecha un periodo hacia adelante o hacia atrás (flechas del selector).
 * @param {Period} period
 * @param {string} date AAAA-MM-DD
 * @param {number} delta 1 = siguiente, -1 = anterior.
 * @returns {string} Un día del nuevo periodo (el primero), AAAA-MM-DD.
 */
export function shiftPeriod(period, date, delta) {
  const d = fromIso(periodRange(period, date).from);
  if (period === 'week') d.setDate(d.getDate() + 7 * delta);
  else if (period === 'month') d.setMonth(d.getMonth() + delta);
  else d.setFullYear(d.getFullYear() + delta);
  return toIso(d);
}

/**
 * ¿El periodo de `date` es el actual? Sirve para no dejar avanzar al futuro.
 * @param {Period} period
 * @param {string} date AAAA-MM-DD
 * @returns {boolean}
 */
export function isCurrentPeriod(period, date) {
  return periodRange(period, date).from === periodRange(period, todayIso()).from;
}

/**
 * Nombre legible del periodo, para títulos: "esta semana", "semana del 6 al 12 de oct.",
 * "octubre", "septiembre de 2025", "2026".
 * @param {Period} period
 * @param {string} date AAAA-MM-DD
 * @returns {string}
 */
export function periodLabel(period, date) {
  const d = fromIso(date);
  const thisYear = new Date().getFullYear();
  if (period === 'year') return String(d.getFullYear());
  if (period === 'month') {
    return d.toLocaleDateString('es-CO', {
      month: 'long',
      ...(d.getFullYear() !== thisYear && { year: 'numeric' }),
    });
  }
  if (isCurrentPeriod('week', date)) return 'esta semana';
  const { from, to } = periodRange('week', date);
  const start = fromIso(from);
  const end = fromIso(to);
  const endText = end.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    ...(end.getFullYear() !== thisYear && { year: 'numeric' }),
  });
  // Si la semana cruza de mes, el inicio también lleva el mes: "del 29 de dic al 4 de ene".
  const startText =
    start.getMonth() === end.getMonth()
      ? String(start.getDate())
      : start.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return `semana del ${startText} al ${endText}`;
}
