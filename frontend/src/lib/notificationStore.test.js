import { describe, expect, it, vi } from 'vitest';
import { createNotificationStore } from '@/lib/notificationStore';

const NEW = { items: [{ id: '1', read: false }], unread: 1 };

/** Promesa que se resuelve cuando la prueba quiera, para decidir en qué orden llegan las respuestas. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createNotificationStore', () => {
  it('guarda lo que trae y avisa a quien escucha', async () => {
    const store = createNotificationStore({ fetchAll: async () => NEW, markAll: async () => null });
    const listener = vi.fn();
    store.subscribe(listener);
    await store.load();
    expect(store.getState()).toMatchObject({ unread: 1, status: 'ready' });
    expect(listener).toHaveBeenCalled();
  });

  it('marcar como leído apaga el conteo de una vez y conserva el resaltado', async () => {
    const markAll = vi.fn(async () => null);
    const store = createNotificationStore({ fetchAll: async () => NEW, markAll });
    await store.load();
    await store.markRead();
    expect(markAll).toHaveBeenCalledOnce();
    expect(store.getState().unread).toBe(0);
    expect(store.getState().items[0].read).toBe(false);
    store.clearHighlights();
    expect(store.getState().items[0].read).toBe(true);
  });

  it('no vuelve a encender el conteo con una respuesta pedida antes de marcar', async () => {
    const late = deferred();
    const fetchAll = vi.fn().mockResolvedValueOnce(NEW).mockReturnValueOnce(late.promise);
    const store = createNotificationStore({ fetchAll, markAll: async () => null });
    await store.load();
    const pending = store.load();
    await store.markRead();
    late.resolve(NEW);
    await pending;
    expect(store.getState().unread).toBe(0);
  });

  it('no llama al servidor si no hay nada sin leer', async () => {
    const markAll = vi.fn(async () => null);
    const store = createNotificationStore({ fetchAll: async () => ({ items: [], unread: 0 }), markAll });
    await store.load();
    await store.markRead();
    expect(markAll).not.toHaveBeenCalled();
  });

  it('si falla sin haber cargado nunca, queda en error; si ya tenía datos, los conserva', async () => {
    const fails = createNotificationStore({ fetchAll: async () => { throw new Error('red'); }, markAll: async () => null });
    await fails.load();
    expect(fails.getState().status).toBe('error');

    const fetchAll = vi.fn().mockResolvedValueOnce(NEW).mockRejectedValueOnce(new Error('red'));
    const keeps = createNotificationStore({ fetchAll, markAll: async () => null });
    await keeps.load();
    await keeps.load();
    expect(keeps.getState()).toMatchObject({ unread: 1, status: 'ready' });
  });

  it('no repite la consulta si la última es reciente', async () => {
    const fetchAll = vi.fn(async () => NEW);
    const store = createNotificationStore({ fetchAll, markAll: async () => null });
    await store.loadIfStale(60_000);
    await store.loadIfStale(60_000);
    expect(fetchAll).toHaveBeenCalledOnce();
    await store.loadIfStale(0);
    expect(fetchAll).toHaveBeenCalledTimes(2);
  });

  it('un fallo al marcar no se propaga', async () => {
    const store = createNotificationStore({
      fetchAll: async () => NEW,
      markAll: async () => {
        throw new Error('red');
      },
    });
    await store.load();
    await expect(store.markRead()).resolves.toBeUndefined();
  });
});
