import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankAdjustment, cardState, dueDates } from './services/cards.logic.js';

const CARD = { limit: 3000000, debtBase: 600000, paymentDay: 15, createdOn: '2026-10-20' };
// Pagos de la tarjeta; por defecto registrados después de la base (cuentan en lo usado).
const pay = (date, amount, afterBase = true) => ({ date, amount, afterBase });
const state = (over) =>
  cardState({ card: CARD, purchases: 16000, payments: [], today: '2026-11-10', ...over });

test('usado y disponible suman la deuda base y las compras', () => {
  const s = state();
  assert.equal(s.used, 616000);
  assert.equal(s.available, 2384000);
});

test('un pago de lo usado deja 0 y uno mayor nunca da negativo', () => {
  assert.equal(state({ payments: [pay('2026-11-01', 616000)] }).used, 0);
  const s = state({ payments: [pay('2026-11-01', 900000)] });
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
    const s = state({ payments: [pay(date, 100000)] });
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
  assert.equal(state({ payments: [pay('2026-10-15', 1)] }).paidThisCycle, false);
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

test('un pago anterior a la base no baja lo usado, pero sí marca el ciclo pagado', () => {
  const s = state({ payments: [pay('2026-11-10', 616000, false)] });
  assert.equal(s.used, 616000);
  assert.equal(s.paidThisCycle, true);
  assert.equal(s.nextPaymentDate, '2026-12-15');
});

test('paidDueDate y paidAmount: el ciclo pagado y la suma de sus pagos', () => {
  const s = state({ payments: [pay('2026-11-05', 300000), pay('2026-11-08', 316000)] });
  assert.equal(s.paidDueDate, '2026-11-15');
  assert.equal(s.paidAmount, 616000);
  assert.equal(s.nextPaymentDate, '2026-12-15');
  const none = state();
  assert.equal(none.paidDueDate, null);
  assert.equal(none.paidAmount, 0);
});

test('sin "Ya pagué" el pago queda atrasado y no salta al mes siguiente', () => {
  const s = state({ today: '2026-11-16' });
  assert.equal(s.nextPaymentDate, '2026-11-15');
  assert.equal(s.daysToPayment, -1);
  assert.equal(s.paidThisCycle, false);
});

test('una tarjeta creada después del vencimiento no queda atrasada', () => {
  const s = state({ today: '2026-11-20', card: { ...CARD, createdOn: '2026-11-18' } });
  assert.equal(s.nextPaymentDate, '2026-12-15');
  assert.equal(s.daysToPayment, 25);
});

test('un pago tardío cubre el ciclo atrasado; el siguiente sigue pendiente', () => {
  const s = state({ today: '2026-11-20', payments: [pay('2026-11-18', 616000)] });
  assert.equal(s.nextPaymentDate, '2026-12-15');
  assert.equal(s.paidThisCycle, false);
  assert.equal(s.paidDueDate, '2026-11-15');
  // Al mes siguiente ese pago tardío no paga diciembre.
  const dec = state({ today: '2026-12-16', payments: [pay('2026-11-18', 616000)] });
  assert.equal(dec.nextPaymentDate, '2026-12-15');
  assert.equal(dec.daysToPayment, -1);
});

test('el extracto se ignora cuando su ciclo ya se pagó o ya pasó', () => {
  const card = { ...CARD, statementTotal: 616000, statementDueDate: '2026-11-15' };
  const open = state({ card });
  assert.equal(open.statementTotal, 616000);
  assert.equal(open.statementDueDate, '2026-11-15');
  // Atrasado: el extracto sigue vigente.
  assert.equal(state({ card, today: '2026-11-16' }).statementTotal, 616000);
  // Pagado: el próximo vencimiento es diciembre y el extracto de noviembre se olvida.
  const paid = state({ card, payments: [pay('2026-11-10', 100000)] });
  assert.equal(paid.statementTotal, null);
  assert.equal(paid.statementDueDate, null);
  // Sin fecha límite: se olvida cuando lo pagado desde la base cubre el total.
  const undated = { ...card, statementDueDate: null };
  assert.equal(
    state({ card: undated, payments: [pay('2026-10-25', 600000)] }).statementTotal,
    616000,
  );
  assert.equal(
    state({ card: undated, payments: [pay('2026-10-25', 616000)] }).statementTotal,
    null,
  );
});

test('cambio de año: diciembre a enero', () => {
  assert.deepEqual(dueDates(15, '2026-12-20'), { previous: '2026-12-15', next: '2027-01-15' });
  const card = { ...CARD, createdOn: '2026-11-20' };
  const paidDec = state({ card, today: '2027-01-03', payments: [pay('2026-12-10', 1)] });
  assert.equal(paidDec.nextPaymentDate, '2027-01-15');
  assert.equal(paidDec.paidDueDate, '2026-12-15');
  const late = state({ card, today: '2027-01-16', payments: [pay('2026-12-10', 1)] });
  assert.equal(late.nextPaymentDate, '2027-01-15');
  assert.equal(late.daysToPayment, -1);
  const paidJan = state({
    card,
    today: '2027-01-03',
    payments: [pay('2026-12-10', 1), pay('2027-01-02', 1)],
  });
  assert.equal(paidJan.nextPaymentDate, '2027-02-15');
});
