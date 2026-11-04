import { useRef } from 'react';

/** Más de esto a la vez no es algo recién anotado: es otra lista (otro mes, "Ver más"). */
const MAX_NEW = 2;

/**
 * Cuáles ids son nuevos respecto a los ya vistos. Agrega a `seen` todo lo recibido.
 * @param {Set<string>} seen
 * @param {string[]} ids
 * @returns {string[]}
 */
export function pickFresh(seen, ids) {
  const first = seen.size === 0;
  const added = ids.filter((id) => !seen.has(id));
  added.forEach((id) => seen.add(id));
  return first || added.length > MAX_NEW ? [] : added;
}

/**
 * Movimientos que aparecieron con la lista ya en pantalla, para resaltarlos al llegar.
 * @param {Array<{ id: string }>|undefined} items
 * @returns {Set<string>}
 */
export default function useFreshIds(items) {
  const seen = useRef(new Set());
  const fresh = useRef(new Set());
  if (items) pickFresh(seen.current, items.map((t) => t.id)).forEach((id) => fresh.current.add(id));
  return fresh.current;
}
