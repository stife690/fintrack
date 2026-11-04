/**
 * Cuánto hace que pasó algo, en palabras cortas: "ahora", "hace 5 min", "hace 3 h", "ayer",
 * "hace 4 días" o la fecha ("12 de oct.") si pasó hace más de una semana.
 * @param {string|Date} when
 * @param {Date} [now]
 * @returns {string}
 */
export function timeAgo(when, now = new Date()) {
  const date = new Date(when);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
