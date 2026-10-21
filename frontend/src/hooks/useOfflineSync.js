import { useEffect, useState } from 'react';
import { conflictMessage } from '@/offline/conflictMessage';

/**
 * Mantiene sincronizada la cola offline mientras la app está abierta (FT-0009) y expone su estado.
 *
 * Sincroniza al montar (por si quedó algo de una sesión anterior), al volver la conexión
 * (evento `online`) y cuando el service worker recibe el aviso de Background Sync.
 * Debe usarse una sola vez, en el layout privado (`AppShell`).
 *
 * `@/offline/sync` (con Dexie) se carga con `import()` para no engordar el bundle inicial.
 * - `pending`: movimientos que esperan enviarse.
 * - `rejected`: los que el servidor rechazó; siguen en la cola hasta que el usuario los descarte.
 * - `conflicts`: avisos de conflicto que el usuario aún no ha visto; `conflictsLost` son los que
 *   significan que **su** cambio no se aplicó (el resto ganó el suyo).
 * @returns {{ pending: number, rejected: number, conflicts: number, conflictsLost: number, syncing: boolean }}
 */
export default function useOfflineSync() {
  const [state, setState] = useState({ pending: 0, rejected: 0, conflicts: 0, conflictsLost: 0, syncing: false });

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;

    import('@/offline/sync').then(({ SYNC_EVENT, SYNC_TAG, listConflicts, listPending, syncNow }) => {
      if (cancelled) return;
      // El evento trae `pending`; los rechazados y los conflictos se cuentan donde permanecen:
      // en la cola y en los avisos guardados, que sobreviven a recargar la app.
      const refresh = () =>
        Promise.all([listPending(), listConflicts()]).then(([ops, conflicts]) => {
          if (cancelled) return;
          setState((s) => ({
            ...s,
            pending: ops.filter((o) => !o.rejected).length,
            rejected: ops.filter((o) => o.rejected).length,
            conflicts: conflicts.length,
            conflictsLost: conflicts.filter((c) => conflictMessage(c).tone === 'warning').length,
          }));
        });
      const onSync = (event) => {
        setState((s) => ({ ...s, pending: event.detail.pending, syncing: event.detail.syncing }));
        refresh();
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

      refresh();
      syncNow();
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return state;
}
