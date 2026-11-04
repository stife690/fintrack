import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RISK_DAYS, buildPaymentCalendar, riskOf } from './services/payment-calendar.service.js';

// Calendario de pagos (FT-0025). Hoy es martes 3 de noviembre de 2026.
const TODAY = '2026-11-03';

const commitment = (name, amount, dayOfMonth) => ({
  id: name.toLowerCase(),
  name,
  amount,
  dayOfMonth,
});

/** Quien cobra los 15 y 30, tiene $1.000.000 hoy y gasta $20.000 en un día normal. */
const base = {
  month: '2026-11',
  today: TODAY,
  profile: { incomeType: 'fecha_fija', payDays: [15, 30] },
  commitments: [
    commitment('Internet', 89000, 5),
    commitment('Netflix', 33900, 9),
    commitment('Arriendo', 850000, 10),
    commitment('Gimnasio', 90000, 20),
  ],
  currentExpenses: [],
  monthExpenses: [],
  vacas: [],
  plan: { ready: true, money: 1000000, pace: 20000, nextPay: '2026-11-15' },
};

const byName = (calendar) => Object.fromEntries(calendar.events.map((e) => [e.name, e]));

test('resta cada pago en orden y dice cuánto queda después', () => {
  const events = byName(buildPaymentCalendar(base));
  assert.equal(events.Internet.balanceAfter, 911000);
  assert.equal(events.Netflix.balanceAfter, 877100);
  assert.equal(events.Arriendo.balanceAfter, 27100);
  assert.equal(events.Internet.risk, 'ok');
});

test(`marca en riesgo el pago que deja menos de ${RISK_DAYS} días de gasto normal`, () => {
  // Después del arriendo quedan $27.100 y una semana normal cuesta $140.000.
  assert.equal(byName(buildPaymentCalendar(base)).Arriendo.risk, 'riesgo');
});

test('marca en negativo el pago que no alcanza a cubrir', () => {
  const calendar = buildPaymentCalendar({ ...base, plan: { ...base.plan, money: 900000 } });
  const events = byName(calendar);
  assert.equal(events.Arriendo.balanceAfter, -72900);
  assert.equal(events.Arriendo.risk, 'negativo');
});

test('después del próximo día de pago no inventa un saldo: no sabe cuánto le pagan', () => {
  const calendar = buildPaymentCalendar(base);
  const { Gimnasio } = byName(calendar);
  assert.equal(Gimnasio.balanceAfter, null);
  assert.equal(Gimnasio.risk, null);
  assert.equal(calendar.projectedUntil, '2026-11-15');
});

test('los días de pago aparecen sin monto', () => {
  const paydays = buildPaymentCalendar(base).events.filter((e) => e.kind === 'ingreso');
  assert.deepEqual(
    paydays.map((e) => [e.date, e.amount]),
    [
      ['2026-11-15', null],
      ['2026-11-30', null],
    ],
  );
});

test('un compromiso ya pagado no se vuelve a restar', () => {
  const calendar = buildPaymentCalendar({
    ...base,
    currentExpenses: [{ description: 'Pago internet hogar' }],
  });
  const events = byName(calendar);
  assert.equal(events.Internet.status, 'pagado');
  assert.equal(events.Internet.balanceAfter, null);
  assert.equal(events.Netflix.balanceAfter, 966100, 'parte de $1.000.000 sin restar internet');
  assert.equal(calendar.totals.paid, 89000);
});

test('lo atrasado se resta primero, como si se pagara hoy', () => {
  const calendar = buildPaymentCalendar({
    ...base,
    commitments: [commitment('Celular', 50000, 1), ...base.commitments],
  });
  const events = byName(calendar);
  assert.equal(events.Celular.status, 'atrasado');
  assert.equal(events.Celular.balanceAfter, 950000);
  assert.equal(events.Internet.balanceAfter, 861000);
});

test('el aporte que falta a una vaca cuenta en su fecha límite', () => {
  const calendar = buildPaymentCalendar({
    ...base,
    vacas: [
      { id: 'v1', name: 'Viaje a Cartagena', deadline: '2026-11-12', myRemaining: 100000 },
      { id: 'v2', name: 'Regalo de Ana', deadline: '2026-11-08', myRemaining: 0 },
    ],
  });
  const events = byName(calendar);
  assert.equal(events['Viaje a Cartagena'].kind, 'vaca');
  assert.equal(events['Viaje a Cartagena'].balanceAfter, 27100 - 100000);
  assert.equal(events['Viaje a Cartagena'].risk, 'negativo');
  assert.equal(events['Regalo de Ana'].status, 'pagado', 'ya aportó todo');
});

test('sin Mi plata configurada muestra los pagos pero no calcula saldos', () => {
  const calendar = buildPaymentCalendar({ ...base, plan: { ready: false } });
  assert.equal(calendar.money, null);
  assert.ok(calendar.events.every((e) => e.balanceAfter === null));
  assert.equal(calendar.totals.pending, 89000 + 33900 + 850000 + 90000);
});

test('sin fecha fija proyecta hasta el fin del mes siguiente', () => {
  const variable = {
    ...base,
    profile: { incomeType: 'sin_fecha', payDays: [] },
    plan: { ready: true, money: 2000000, pace: null },
  };
  const november = buildPaymentCalendar(variable);
  assert.equal(november.projectedUntil, '2027-01-01');
  assert.equal(byName(november).Gimnasio.balanceAfter, 2000000 - 1062900);

  const december = byName(buildPaymentCalendar({ ...variable, month: '2026-12' }));
  // Diciembre empieza con lo que queda después de todo noviembre.
  assert.equal(december.Internet.balanceAfter, 2000000 - 1062900 - 89000);
  assert.equal(december.Internet.status, 'pendiente');
});

test('en un mes pasado solo dice si hubo un gasto con su nombre', () => {
  const october = byName(
    buildPaymentCalendar({
      ...base,
      month: '2026-10',
      monthExpenses: [{ description: 'Arriendo octubre' }],
    }),
  );
  assert.equal(october.Arriendo.status, 'pagado');
  assert.equal(october.Internet.status, 'sin_registro');
  assert.equal(october.Internet.balanceAfter, null);
});

test('sin historial de gasto solo se avisa el negativo', () => {
  assert.equal(riskOf(1000, null), 'ok');
  assert.equal(riskOf(-1, null), 'negativo');
  assert.equal(riskOf(139999, 20000), 'riesgo');
  assert.equal(riskOf(140000, 20000), 'ok');
});

// Forma que arma getCalendar desde cards.service: nextPaymentDate es siempre el primer pago sin hacer.
const CARD = {
  id: 'c1',
  name: 'Amex 1234',
  nextPaymentDate: '2026-11-20',
  amount: 400000,
  paidDueDate: null,
  paidAmount: 0,
};
const findCard = (cards, m = '2026-11') =>
  buildPaymentCalendar({ ...base, month: m, cards }).events.filter((e) => e.kind === 'card');

test('la tarjeta aparece con su próximo pago: pendiente o atrasada', () => {
  const [e] = findCard([CARD]);
  assert.deepEqual([e.date, e.amount, e.status, e.name], ['2026-11-20', 400000, 'pendiente', 'Amex 1234']);
  assert.equal(findCard([{ ...CARD, nextPaymentDate: '2026-11-01' }])[0].status, 'atrasado');
  assert.deepEqual(findCard([CARD], '2026-12'), []);
});

test('una tarjeta pagada sale "pagado" en la fecha del ciclo pagado con lo que se pagó', () => {
  // Pagó el ciclo del 20 nov: el próximo pago ya es el 20 dic.
  const paid = { ...CARD, nextPaymentDate: '2026-12-20', amount: 16000, paidDueDate: '2026-11-20', paidAmount: 616000 };
  const cal = buildPaymentCalendar({ ...base, cards: [paid] });
  const [e] = cal.events.filter((x) => x.kind === 'card');
  assert.deepEqual([e.date, e.status, e.amount], ['2026-11-20', 'pagado', 616000]);
  assert.equal(cal.totals.paid, 616000);
  const [dec] = findCard([paid], '2026-12');
  assert.deepEqual([dec.date, dec.status, dec.amount], ['2026-12-20', 'pendiente', 16000]);
});

test('una tarjeta sin deuda no sale como pendiente de $0', () => {
  const zero = { ...CARD, amount: 0 };
  assert.deepEqual(findCard([zero]), []);
  assert.equal(buildPaymentCalendar({ ...base, cards: [zero] }).totals.pending, 1062900);
});

test('el pago de tarjeta pendiente se descuenta antes de los pagos que vienen después', () => {
  const card = { ...CARD, nextPaymentDate: '2026-11-07' };
  const events = byName(buildPaymentCalendar({ ...base, cards: [card] }));
  assert.equal(events['Amex 1234'].balanceAfter, 511000); // 1.000.000 - 89.000 (Internet, día 5) - 400.000
  assert.equal(events['Amex 1234'].risk, 'ok');
  assert.equal(events.Netflix.balanceAfter, 477100);
  const paid = { ...card, nextPaymentDate: '2026-12-07', paidDueDate: '2026-11-07', paidAmount: 400000 };
  assert.equal(byName(buildPaymentCalendar({ ...base, cards: [paid] })).Netflix.balanceAfter, 877100);
});
