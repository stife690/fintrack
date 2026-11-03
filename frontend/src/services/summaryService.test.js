import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiRequest', () => ({ apiRequest: vi.fn() }));
vi.mock('@/services/transactionService', () => ({ listTransactions: vi.fn() }));

const { apiRequest } = await import('@/lib/apiRequest');
const { listTransactions } = await import('@/services/transactionService');
const { getSummary } = await import('@/services/summaryService');

describe('summaryService: el ahorro no es gasto', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    listTransactions.mockReset();
  });

  it('una API sin `savings` (backend anterior) deja el ahorro en 0', async () => {
    apiRequest.mockResolvedValue({
      income: { total: 100, byCategory: [] },
      expense: { total: 40, byCategory: [] },
      timeSeries: [],
    });
    const summary = await getSummary('month', '2026-11-03');
    expect(summary.savings).toEqual({ total: 0 });
    expect(summary.balance).toBe(60);
  });

  it('el balance resta gastos y ahorro de lo que entró', async () => {
    apiRequest.mockResolvedValue({
      period: 'month',
      from: '2026-11-01',
      to: '2026-11-30',
      income: { total: 3200000, byCategory: [] },
      expense: { total: 55600, byCategory: [] },
      savings: { total: 200000 },
      timeSeries: [],
    });
    const summary = await getSummary('month', '2026-11-03');
    expect(summary.balance).toBe(2944400);
  });

  it('sin el endpoint, el cálculo local aparta el ahorro igual que la API', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('no existe'), { code: 'NOT_FOUND' }));
    listTransactions.mockResolvedValue({
      total: 3,
      data: [
        { type: 'ingreso', category: 'salario', amount: 3200000, date: '2026-11-01' },
        { type: 'gasto', category: 'ahorro_inversion', amount: 200000, date: '2026-11-03' },
        { type: 'gasto', category: 'alimentacion', amount: 55600, date: '2026-11-03' },
      ],
    });
    const summary = await getSummary('month', '2026-11-03');
    expect(summary.expense).toEqual({
      total: 55600,
      byCategory: [{ category: 'alimentacion', total: 55600, percentage: 100 }],
    });
    expect(summary.savings).toEqual({ total: 200000 });
    expect(summary.timeSeries).toEqual([
      { date: '2026-11-01', income: 3200000, expense: 0 },
      { date: '2026-11-03', income: 0, expense: 55600 },
    ]);
    expect(summary.balance).toBe(2944400);
  });
});
