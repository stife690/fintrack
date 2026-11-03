import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiRequest', () => ({ apiRequest: vi.fn() }));
vi.mock('@/offline/cardCache', () => ({ cacheCardList: vi.fn(), getCachedCardList: vi.fn() }));

const { apiRequest } = await import('@/lib/apiRequest');
const { cacheCardList, getCachedCardList } = await import('@/offline/cardCache');
const { listCards, payCard } = await import('@/services/cardService');

describe('cardService', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    cacheCardList.mockReset();
    getCachedCardList.mockReset();
  });

  it('listCards guarda en caché lo que responde el servidor', async () => {
    apiRequest.mockResolvedValue([{ id: 'c1' }]);
    expect(await listCards()).toEqual([{ id: 'c1' }]);
    expect(cacheCardList).toHaveBeenCalledWith([{ id: 'c1' }]);
  });

  it('sin conexión, listCards devuelve la caché', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('x'), { code: 'NETWORK_ERROR' }));
    getCachedCardList.mockResolvedValue([{ id: 'c2' }]);
    expect(await listCards()).toEqual([{ id: 'c2' }]);
  });

  it('otro error se propaga', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('x'), { code: 'FORBIDDEN' }));
    await expect(listCards()).rejects.toThrow('x');
  });

  it('payCard hace POST a /cards/:id/payments', async () => {
    apiRequest.mockResolvedValue({});
    await payCard('c1', { amount: 5, date: '2026-11-03' });
    expect(apiRequest).toHaveBeenCalledWith('/cards/c1/payments', { method: 'POST', body: { amount: 5, date: '2026-11-03' } });
  });
});
