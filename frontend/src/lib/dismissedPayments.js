const KEY = 'fintrack:avisos-cerrados';

const paymentKey = ({ id, date }) => `${id}-${date}`;

/** @returns {string[]} Avisos de pago que la persona cerró en este dispositivo. */
export function readDismissed() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Recuerda que se cerró un aviso. Si no se puede guardar, solo dura esta visita. */
export function saveDismissed(keys) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    // Almacenamiento no disponible.
  }
}

/**
 * Los pagos que siguen visibles. Cada aviso incluye la fecha: el pago del mes siguiente vuelve a avisar.
 * @template {{ id: string, date: string }} T
 * @param {T[]} pending
 * @param {string[]} dismissed
 * @returns {T[]}
 */
export const visiblePayments = (pending, dismissed) => pending.filter((p) => !dismissed.includes(paymentKey(p)));

export { paymentKey };
