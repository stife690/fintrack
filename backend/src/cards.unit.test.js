import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankAdjustment, cardState, dueDates } from './services/cards.logic.js';

const CARD = { limit: 3000000, debtBase: 600000, paymentDay: 15 };
const state = (over) =>
  cardState({ card: CARD, purchases: 16000, payments: [], today: '2026-11-10', ...over });

test('usado y disponible suman la deuda base y las compras', () => {
  const s = state();
  assert.equal(s.used, 616000);
  assert.equal(s.available, 2384000);
});

test('un pago de lo usado deja 0 y uno mayor nunca da negativo', () => {
  assert.equal(state({ payments: [{ date: '2026-11-01', amount: 616000 }] }).used, 0);
  const s = state({ payments: [{ date: '2026-11-01', amount: 900000 }] });
  assert.equal(s.used, 0);
  assert.equal(s.available, 3000000);
});

test('dueDates: el 31 cae el último día del mes', () => {
  assert.deepEqual(dueDates(31, '2026-02-10'), { previous: '2026-01-31', next: '2026-02-28' });
});

test('dueDates: el día de pago de hoy cuenta como próximo', () => {
  assert.equal(dueDates(15, '2026-11-15').next, '2026-11-15');
  assert.equal(dueDates(15, '2026-11-16').next, '2026-12-15');
});

test('un pago en el ciclo mueve el próximo pago al mes siguiente', () => {
  for (const date of ['2026-11-10', '2026-11-15']) {
    const s = state({ payments: [{ date, amount: 100000 }] });
    assert.equal(s.paidThisCycle, true);
    assert.equal(s.nextPaymentDate, '2026-12-15');
  }
});

test('sin pagos el próximo pago es el de este ciclo', () => {
  const s = state();
  assert.equal(s.paidThisCycle, false);
  assert.equal(s.nextPaymentDate, '2026-11-15');
  assert.equal(s.daysToPayment, 5);
});

test('un pago del ciclo anterior no cuenta', () => {
  assert.equal(state({ payments: [{ date: '2026-10-15', amount: 1 }] }).paidThisCycle, false);
});

test('bankAdjustment devuelve la diferencia con signo y la nueva deuda base', () => {
  assert.deepEqual(bankAdjustment({ used: 616000, limit: 3000000, available: 2350000 }), {
    difference: 34000,
    newDebtBase: 650000,
  });
  assert.equal(
    bankAdjustment({ used: 616000, limit: 3000000, available: 2400000 }).difference,
    -16000,
  );
});
