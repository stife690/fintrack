import { describe, expect, it } from 'vitest';
import { paymentKey, visiblePayments } from '@/lib/dismissedPayments';
import { paymentTotals } from '@/pages/app/MoneyPayments';

describe('visiblePayments', () => {
  const pending = [{ id: 'a', date: '2026-11-08' }, { id: 'b', date: '2026-11-10' }];

  it('quita solo el aviso cerrado', () => {
    expect(visiblePayments(pending, [paymentKey(pending[0])])).toEqual([pending[1]]);
  });

  it('el pago del mes siguiente vuelve a avisar', () => {
    expect(visiblePayments([{ id: 'a', date: '2026-12-08' }], ['a-2026-11-08'])).toHaveLength(1);
  });
});

describe('paymentTotals', () => {
  it('separa lo pagado de lo que falta y solo cuenta pagos propios', () => {
    const events = [
      { kind: 'compromiso', status: 'pagado', amount: 400000 },
      { kind: 'compromiso', status: 'pendiente', amount: 90000 },
      { kind: 'compromiso', status: 'atrasado', amount: 10000 },
      { kind: 'card', status: 'pendiente', amount: 320000 },
      { kind: 'ingreso', status: null, amount: null },
    ];
    expect(paymentTotals(events)).toEqual({ pending: 100000, paid: 400000 });
  });
});
