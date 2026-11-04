import { useCallback, useSyncExternalStore } from 'react';

/**
 * Si la pantalla cumple una media query (p. ej. `(width < 48rem)`), y se actualiza al girar el
 * celular o cambiar el tamaño de la ventana.
 * @param {string} query
 * @returns {boolean}
 */
export default function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  // Sin ventana (render en servidor o en pruebas) se asume que no coincide.
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
