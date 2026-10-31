import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Tabla en memoria con lo que usa `vacaQueue` de Dexie. */
function fakeTable(key) {
  const rows = new Map();
  return {
    rows,
    add: vi.fn(async (row) => rows.set(row[key], row)),
    put: vi.fn(async (row) => rows.set(row[key], row)),
    get: vi.fn(async (id) => rows.get(id)),
    delete: vi.fn(async (id) => rows.delete(id)),
    update: vi.fn(async (id, changes) => rows.set(id, { ...rows.get(id), ...changes })),
    where: (field) => ({
      equals: (value) => ({
        sortBy: async (by) => [...rows.values()].filter((r) => r[field] === value).sort((a, b) => (a[by] < b[by] ? -1 : 1)),
      }),
      startsWith: (prefix) => ({
        delete: async () => [...rows.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => rows.delete(k)),
      }),
    }),
  };
}

const db = { vacaPending: fakeTable('localId'), transactions: fakeTable('id'), meta: fakeTable('key') };
vi.mock('./db', () => ({ db }));
vi.mock('@/auth/tokenStorage', () => ({ getSession: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/services/vacaService', () => ({ contribute: vi.fn() }));

const { contribute } = await import('@/services/vacaService');
const queue = await import('./vacaQueue');

const values = { amount: 20000, date: '2026-10-30', note: null, category: null };
const result = {
  contribution: { id: 'c1' },
  transaction: { id: 't1', amount: 20000, deletedAt: null },
  vaca: { id: 'v1', total: 20000 },
};

describe('vacaQueue (FT-0014, aportes sin conexión)', () => {
  let online;
  let events;
  beforeEach(() => {
    online = true;
    vi.stubGlobal('navigator', {
      get onLine() {
        return online;
      },
    });
    const win = new EventTarget();
    events = [];
    win.addEventListener(queue.VACA_SYNC_EVENT, (e) => events.push(e.detail));
    vi.stubGlobal('window', win);
    Object.values(db).forEach((t) => t.rows.clear());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('con conexión envía el aporte y guarda el gasto y la vaca en el dispositivo', async () => {
    contribute.mockResolvedValue(result);
    await expect(queue.saveContribution('v1', values)).resolves.toEqual({ queued: false, result });
    expect(contribute).toHaveBeenCalledWith('v1', { ...values, localId: expect.any(String) });
    expect(db.transactions.rows.get('t1')).toMatchObject({ id: 't1', userId: 'u1' });
    expect(await queue.getCachedVaca('v1')).toEqual(result.vaca);
    expect(db.vacaPending.rows.size).toBe(0);
  });

  it('sin conexión lo deja en la cola y lo envía al volver la red con el mismo localId', async () => {
    online = false;
    await expect(queue.saveContribution('v1', values)).resolves.toEqual({ queued: true });
    expect(contribute).not.toHaveBeenCalled();
    const [pending] = await queue.listPendingContributions('v1');
    expect(pending.contribution.amount).toBe(20000);

    online = true;
    contribute.mockResolvedValue(result);
    await queue.flushContributions();
    expect(contribute).toHaveBeenCalledWith('v1', { ...pending.contribution, localId: pending.localId });
    expect(await queue.listPendingContributions()).toEqual([]);
    expect(events.at(-1)).toEqual({ vacaId: 'v1', synced: 1, fromQueue: true });
  });

  it('si el servidor no responde (sin código de error) también queda en la cola', async () => {
    contribute.mockRejectedValue(new Error('No pudimos conectar con el servidor.'));
    await expect(queue.saveContribution('v1', values)).resolves.toEqual({ queued: true });
    expect(db.vacaPending.rows.size).toBe(1);
  });

  it('un error de datos no se encola: se muestra al usuario', async () => {
    contribute.mockRejectedValue(Object.assign(new Error('Fecha inválida'), { code: 'VALIDATION_ERROR' }));
    await expect(queue.saveContribution('v1', values)).rejects.toThrow('Fecha inválida');
    expect(db.vacaPending.rows.size).toBe(0);
  });

  it('un rechazo al enviar la cola la marca con el motivo y no la borra; un fallo de red la deja igual', async () => {
    online = false;
    await queue.saveContribution('v1', values);
    online = true;

    contribute.mockRejectedValueOnce(new Error('sin red'));
    await queue.flushContributions();
    expect((await queue.listPendingContributions())[0].rejected).toBeUndefined();

    contribute.mockRejectedValueOnce(Object.assign(new Error('Vaca no encontrada'), { code: 'NOT_FOUND' }));
    await queue.flushContributions();
    const [rejected] = await queue.listPendingContributions();
    expect(rejected.rejected).toBe('Vaca no encontrada');

    await queue.flushContributions();
    expect(contribute).toHaveBeenCalledTimes(2); // el rechazado ya no se reenvía

    await queue.discardPendingContribution(rejected.localId);
    expect(await queue.listPendingContributions()).toEqual([]);
  });

  it('al cerrar sesión borra la copia de las vacas pero no los aportes pendientes', async () => {
    await queue.cacheVacaList([{ id: 'v1' }]);
    await queue.cacheVaca({ id: 'v1' });
    online = false;
    await queue.saveContribution('v1', values);
    await queue.clearVacaCache('u1');
    expect(await queue.getCachedVacaList()).toBeNull();
    expect(await queue.getCachedVaca('v1')).toBeNull();
    expect(db.vacaPending.rows.size).toBe(1);
  });
});
