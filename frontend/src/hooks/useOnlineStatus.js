import { useEffect, useState } from 'react';

/**
 * Indica si el navegador tiene conexión y se actualiza al perderla o recuperarla.
 *
 * `false` es confiable: no hay ninguna red. `true` solo significa que hay alguna red,
 * no que el servidor responda; por eso las peticiones igual manejan sus errores.
 * @returns {boolean}
 */
export default function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
