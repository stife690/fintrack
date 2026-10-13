const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});

/**
 * @param {number} amount
 * @returns {string} Monto en pesos colombianos, p. ej. `$ 12.500`.
 */
export function formatMoney(amount) {
  return money.format(amount);
}

/**
 * Formatea una fecha AAAA-MM-DD sin pasar por UTC (evita que se corra un día).
 * @param {string} iso
 * @returns {string} p. ej. `12 oct 2026`.
 */
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
