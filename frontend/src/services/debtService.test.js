import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiRequest', () => ({ apiRequest: vi.fn() }));

const { apiRequest } = await import('@/lib/apiRequest');
const { createDebt, deleteDebt, listDebts, settleDebt, updateDebt } = await import('@/services/debtService');

describe('debtService', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({});
  });

  it('lista, crea, edita y borra en /debts', async () => {
    await listDebts();
    await createDebt({ kind: 'receivable', person: 'Juan', amount: 5 });
    await updateDebt('d1', { amount: 6 });
    await deleteDebt('d1');
    expect(apiRequest.mock.calls).toEqual([
      ['/debts'],
      [
        '/debts',
        {
          method: 'POST',
          body: { kind: 'receivable', person: 'Juan', amount: 5 },
        },
      ],
      ['/debts/d1', { method: 'PUT', body: { amount: 6 } }],
      ['/debts/d1', { method: 'DELETE' }],
    ]);
  });

  it('settleDebt dice si se crea el movimiento', async () => {
    await settleDebt('d1', { createTransaction: false });
    expect(apiRequest).toHaveBeenCalledWith('/debts/d1/settle', {
      method: 'POST',
      body: { createTransaction: false },
    });
  });
});
