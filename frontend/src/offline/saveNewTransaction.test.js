import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/transactionService', () => ({ createTransaction: vi.fn() }));
vi.mock('./sync', () => ({ cacheTransaction: vi.fn(() => Promise.resolve()), queueCreate: vi.fn() }));

const { createTransaction } = await import('@/services/transactionService');
const { cacheTransaction, queueCreate } = await import('./sync');
const { TRANSACTION_SAVED_EVENT, saveNewTransaction } = await import('./saveNewTransaction');

const values = { type: 'gasto', amount: 15000, description: 'Almuerzo', date: '2026-10-28', category: null };
const saved = { id: 't1', ...values, category: 'alimentacion', source: 'ia' };

describe('saveNewTransaction', () => {
  let announced;
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
    const win = new EventTarget();
    announced = [];
    win.addEventListener(TRANSACTION_SAVED_EVENT, (event) => announced.push(event.detail));
    vi.stubGlobal('window', win);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('con conexión lo envía al servidor y guarda la copia local', async () => {
    createTransaction.mockResolvedValue({ transaction: saved, alert: null });
    await expect(saveNewTransaction(values)).resolves.toEqual({ transaction: saved, alert: null, offline: false });
    expect(createTransaction).toHaveBeenCalledWith({ ...values, localId: expect.any(String) });
    expect(cacheTransaction).toHaveBeenCalledWith(saved);
    expect(queueCreate).not.toHaveBeenCalled();
    expect(announced).toEqual([{ transaction: saved, alert: null, offline: false }]);
  });

  it('si la red falla lo deja en la cola con el mismo localId', async () => {
    createTransaction.mockRejectedValue(Object.assign(new Error('sin red'), { code: 'NETWORK_ERROR' }));
    await expect(saveNewTransaction(values)).resolves.toEqual({ transaction: null, alert: null, offline: true });
    const { localId } = createTransaction.mock.calls[0][0];
    expect(queueCreate).toHaveBeenCalledWith(values, localId);
    expect(announced).toEqual([{ transaction: null, alert: null, offline: true }]);
  });

  it('sin conexión ni lo intenta: va directo a la cola', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(saveNewTransaction(values)).resolves.toMatchObject({ offline: true });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(queueCreate).toHaveBeenCalled();
  });

  it('si el servidor lo rechaza, lanza el error y no lo encola', async () => {
    createTransaction.mockRejectedValue(Object.assign(new Error('Monto inválido'), { code: 'VALIDATION_ERROR' }));
    await expect(saveNewTransaction(values)).rejects.toThrow('Monto inválido');
    expect(queueCreate).not.toHaveBeenCalled();
    expect(announced).toEqual([]);
  });
});
