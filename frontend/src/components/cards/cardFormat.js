/** "15 nov" a partir de AAAA-MM-DD, sin pasar por UTC. */
export function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  return `${d} ${month}`;
}

/** Cuándo toca pagar: "Pagas en 5 días (15 nov)". */
export function paymentText(card) {
  if (card.paidThisCycle) return 'Pago de este mes al día';
  const when = card.nextPaymentDate ? ` (${shortDate(card.nextPaymentDate)})` : '';
  if (card.daysToPayment === 0) return `Pagas hoy${when}`;
  if (card.daysToPayment === 1) return `Pagas en 1 día${when}`;
  return `Pagas en ${card.daysToPayment} días${when}`;
}
