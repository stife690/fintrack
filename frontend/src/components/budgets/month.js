/**
 * Utilidades de meses en formato AAAA-MM (el formato de los presupuestos).
 * Se calculan con la fecha local del dispositivo, no con UTC, para no saltar de mes de noche.
 */

/** @returns {string} El mes actual, p. ej. `2026-10`. */
export function currentMonth() {
  return new Date().toLocaleDateString('en-CA').slice(0, 7);
}

/**
 * @param {string} month AAAA-MM
 * @param {number} delta Meses a mover (negativo para ir atrás).
 * @returns {string} El mes resultante en AAAA-MM.
 */
export function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {string} month AAAA-MM
 * @returns {string} Nombre legible, p. ej. `octubre de 2026`.
 */
export function formatMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}
