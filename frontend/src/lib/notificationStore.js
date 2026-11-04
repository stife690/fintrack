/**
 * Estado de los avisos, una sola copia para la campana y el punto del avatar.
 * Va aparte de React para poder probar el orden de las respuestas sin navegador.
 *
 * @param {{ fetchAll: () => Promise<{ items: object[], unread: number }>, markAll: () => Promise<unknown> }} api
 */
export function createNotificationStore({ fetchAll, markAll }) {
  let state = { items: [], unread: 0, status: 'loading' }; // status: loading | ready | error
  // Cambia al marcar como leído: una respuesta de antes de ese momento ya está vieja y se ignora.
  let generation = 0;
  let askedAt = null;
  const listeners = new Set();

  const set = (changes) => {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Trae los avisos. Si falla, se queda con lo último que supo. */
    async load() {
      const asked = generation;
      askedAt = Date.now();
      try {
        const { items, unread } = await fetchAll();
        if (asked === generation) set({ items, unread, status: 'ready' });
      } catch {
        if (asked === generation && state.status !== 'ready') set({ status: 'error' });
      }
    },

    /** Trae los avisos solo si la última consulta tiene más de `maxAgeMs`. */
    loadIfStale(maxAgeMs) {
      return askedAt === null || Date.now() - askedAt >= maxAgeMs ? this.load() : Promise.resolve();
    },

    /** Marca todo como leído. En pantalla siguen resaltados hasta `clearHighlights`, para ver cuáles eran nuevos. */
    async markRead() {
      if (state.unread === 0) return;
      generation += 1;
      set({ unread: 0 });
      await markAll().catch(() => {});
      generation += 1; // lo que se pidió mientras el servidor marcaba tampoco sirve
    },

    clearHighlights() {
      set({ unread: 0, items: state.items.map((item) => ({ ...item, read: true })) });
    },
  };
}
