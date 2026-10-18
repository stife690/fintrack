import { useCallback, useEffect, useState } from 'react';

/**
 * Ejecuta una carga asíncrona y expone su estado. Ignora respuestas que llegan después de
 * desmontar el componente o de que cambien las dependencias (evita pisar datos nuevos con viejos).
 *
 * @template T
 * @param {() => Promise<T>} load Función que trae los datos.
 * @param {unknown[]} deps Cuándo volver a cargar (como en `useEffect`).
 * @returns {{ data: T|undefined, error: string, loading: boolean, reload: () => void }}
 */
export default function useAsync(load, deps) {
  const [state, setState] = useState({ data: undefined, error: '', loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    load()
      .then((data) => !cancelled && setState({ data, error: '', loading: false }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, error: err.message, loading: false })));
    return () => {
      cancelled = true;
    };
    // `load` cambia en cada render; quien llama decide cuándo recargar con `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
