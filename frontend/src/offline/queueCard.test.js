import { beforeEach, describe, expect, it, vi } from 'vitest';

const add = vi.fn();
vi.mock('./db', () => ({ db: { pending: { add, where: () => ({ equals: () => ({ sortBy: async () => [] }) }) } } }));
vi.mock('./vacaQueue', () => ({ clearVacaCache: vi.fn(), flushContributions: vi.fn() }));
vi.mock('./cardCache', () => ({ clearCardCache: vi.fn() }));
vi.mock('@/lib/apiRequest', () => ({ apiRequest: vi.fn() }));
vi.mock('@/auth/tokenStorage', () => ({ getSession: () => ({ user: { id: 'u1' } }) }));

const { queueCreate } = await import('./sync');

describe('queueCreate con tarjeta', () => {
  beforeEach(() => {
    add.mockReset();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('navigator', {});
  });
  const base = { type: 'gasto', amount: 10, description: 'x', date: '2026-10-01', category: null };
  it('conserva card e installments', async () => {
    await queueCreate({ ...base, card: 'c1', installments: 6 });
    expect(add.mock.calls[0][0].transaction).toMatchObject({ card: 'c1', installments: 6 });
  });
  it('sin tarjeta (voz, barra rápida) van en null', async () => {
    await queueCreate(base);
    expect(add.mock.calls[0][0].transaction).toMatchObject({ card: null, installments: null });
  });
});
