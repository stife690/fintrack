/**
 * Navegación con teclado de una lista de pestañas (patrón WAI-ARIA "tabs"):
 * flechas izquierda/derecha para moverse (dando la vuelta), Inicio y Fin para ir a los extremos.
 * Mueve el foco a la pestaña nueva y la activa.
 *
 * @param {KeyboardEvent} event
 * @param {number} current Índice de la pestaña activa.
 * @param {number} count Número de pestañas.
 * @param {(index: number) => void} select Activa la pestaña del índice dado.
 */
export function handleTabKeys(event, current, count, select) {
  const next = {
    ArrowRight: (current + 1) % count,
    ArrowLeft: (current - 1 + count) % count,
    Home: 0,
    End: count - 1,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  select(next);
  const tabs = event.currentTarget.querySelectorAll('[role="tab"]');
  tabs[next]?.focus();
}
