/** Textos de las cuentas por cobrar y por pagar (FT-0046). */

const DAY_MS = 86_400_000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/**
 * Días entre dos fechas AAAA-MM-DD (positivo si `to` es después de `from`).
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Cuándo vence una cuenta pendiente, en palabras.
 * @param {string|null} dueDate AAAA-MM-DD.
 * @param {string} today AAAA-MM-DD.
 * @returns {{ text: string, late: boolean }|null} `null` si no tiene fecha.
 */
export function dueText(dueDate, today) {
  if (!dueDate) return null;
  const days = daysBetween(today, dueDate);
  if (days < 0) {
    return {
      text: days === -1 ? 'Venció ayer' : `Venció hace ${-days} días`,
      late: true,
    };
  }
  if (days === 0) return { text: 'Vence hoy', late: false };
  if (days === 1) return { text: 'Vence mañana', late: false };
  if (days <= 7) return { text: `Vence en ${days} días`, late: false };
  const [y, m, d] = dueDate.split('-').map(Number);
  const year = today.slice(0, 4) === dueDate.slice(0, 4) ? '' : ` ${y}`;
  return { text: `Vence el ${d} ${MONTHS[m - 1]}${year}`, late: false };
}

/** Palabras de cada lado: la pestaña, el botón de saldar y el movimiento que se crea. */
export const DEBT_WORDS = {
  receivable: {
    tab: 'Me deben',
    settle: 'Ya me pagó',
    movement: 'Registrar el ingreso en Movimientos',
    empty: 'Nadie te debe nada. Anota aquí cuando le prestes plata a alguien.',
  },
  payable: {
    tab: 'Debo',
    settle: 'Ya pagué',
    movement: 'Registrar el gasto en Movimientos',
    empty: 'No le debes a nadie. Anota aquí lo que te prestan para no olvidarlo.',
  },
};
