import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiRequest', () => ({ apiRequest: vi.fn() }));

const { apiRequest } = await import('@/lib/apiRequest');
const service = await import('@/services/pendingPaymentService');

describe('pendingPaymentService', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({});
  });

  it('maneja el token del Atajo en /pending-payments/token', async () => {
    await service.getShortcutToken();
    await service.createShortcutToken();
    await service.revokeShortcutToken();
    expect(apiRequest.mock.calls).toEqual([
      ['/pending-payments/token'],
      ['/pending-payments/token', { method: 'POST' }],
      ['/pending-payments/token', { method: 'DELETE' }],
    ]);
  });

  it('lista, confirma y descarta pagos', async () => {
    await service.listPendingPayments();
    await service.confirmPendingPayment('p1', { category: 'alimentacion' });
    await service.discardPendingPayment('p1');
    expect(apiRequest.mock.calls).toEqual([
      ['/pending-payments'],
      ['/pending-payments/p1/confirm', { method: 'POST', body: { category: 'alimentacion' } }],
      ['/pending-payments/p1/discard', { method: 'POST' }],
    ]);
  });

  it('el Atajo apunta a /shortcuts/payments', () => {
    expect(service.SHORTCUT_URL).toMatch(/\/api\/v1\/shortcuts\/payments$/);
  });
});
