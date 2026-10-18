import { useCallback, useState } from 'react';

const STORAGE_KEY = 'fintrack:hide-amounts';

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Ocultar los montos del inicio (para usar la app en público). Se recuerda en este dispositivo.
 * @returns {[boolean, () => void]} `[ocultos, alternar]`
 */
export default function useHiddenAmounts() {
  const [hidden, setHidden] = useState(read);
  const toggle = useCallback(() => {
    setHidden((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Sin almacenamiento: dura hasta cerrar la app.
      }
      return next;
    });
  }, []);
  return [hidden, toggle];
}
