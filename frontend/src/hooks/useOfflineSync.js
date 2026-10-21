import { useEffect, useState } from 'react';

/**
 * Mantiene sincronizada la cola offline mientras la app está abierta (FT-0009) y expone su estado.
 *
 * Sincroniza al montar (por si quedó algo de una sesión anterior), al volver la conexión
 * (evento `online`) y cuando el service worker recibe el aviso de Background Sync.
 * Debe usarse una sola vez, en el layout privado (`AppShell`).
 *
 * `@/offline/sync` (con Dexie) se carga con `import()` para no engordar el bundle inicial.
 * `pending` son los movimientos que esperan enviarse; `rejected`, los que el servidor rechazó y
 * siguen en la cola hasta que el usuario los descarte.
 * @returns {{ pending: number, rejected: number, syncing: boolean }}
 */
export default function useOfflineSync() {
  const [state, setState] = useState({ pending: 0, rejected: 0, syncing: false });

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;

    import('@/offline/sync').then(({ SYNC_EVENT, SYNC_TAG, listPending, syncNow }) => {
      if (cancelled) return;
      // El evento trae `pending`; los rechazados se cuentan en la cola, que es donde permanecen.
      const countRejected = () =>
        listPending().then(
          (ops) => !cancelled && setState((s) => ({ ...s, rejected: ops.filter((o) => o.rejected).length })),
        );
      const onSync = (event) => {
        setState((s) => ({ ...s, pending: event.detail.pending, syncing: event.detail.syncing }));
        countRejected();
      };
      const onOnline = () => syncNow();
      const onMessage = (event) => event.data?.type === SYNC_TAG && syncNow();

      window.addEventListener(SYNC_EVENT, onSync);
      window.addEventListener('online', onOnline);
      navigator.serviceWorker?.addEventListener('message', onMessage);
      cleanup = () => {
        window.removeEventListener(SYNC_EVENT, onSync);
        window.removeEventListener('online', onOnline);
        navigator.serviceWorker?.removeEventListener('message', onMessage);
      };

      listPending().then(
        (ops) =>
          !cancelled &&
          setState((s) => ({
            ...s,
            pending: ops.filter((o) => !o.rejected).length,
            rejected: ops.filter((o) => o.rejected).length,
          })),
      );
      syncNow();
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return state;
}
