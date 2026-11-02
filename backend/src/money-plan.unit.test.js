import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMoneyPlan,
  dailyRhythm,
  dateInMonth,
  nextPayDate,
  pendingCommitments,
} from './services/money-plan.service.js';

const TODAY = '2026-11-16';
const NO_CHANGES = { income: 0, expense: 0 };
const ARRIENDO = { id: 'a', name: 'Arriendo', amount: 350000, dayOfMonth: 30 };
const CELULAR = { id: 'c', name: 'Celular', amount: 45000, dayOfMonth: 20 };

const gasto = (amount, date, description = 'Almuerzo', category = 'alimentacion') => ({
  type: 'gasto',
  amount,
  date,
  description,
  category,
});
const ingreso = (amount, date) => ({ type: 'ingreso', amount, date, description: 'Pago', category: 'salario' });

/** Un gasto al día durante 30 días, hasta `TODAY`. */
const dailyExpenses = (amount) =>
  Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 10, 16 - i)).toISOString().slice(0, 10);
    return gasto(amount, date);
  });

test('un 31 cae el último día en los meses cortos', () => {
  assert.equal(dateInMonth('2026-11', 31), '2026-11-30');
  assert.equal(dateInMonth('2027-02', 30), '2027-02-28');
  assert.equal(dateInMonth('2026-12', 31), '2026-12-31');
});

test('el próximo pago es el siguiente día de pago después de hoy', () => {
  assert.equal(nextPayDate([15, 30], '2026-11-02'), '2026-11-15');
  assert.equal(nextPayDate([15, 30], '2026-11-15'), '2026-11-30', 'hoy no cuenta');
  assert.equal(nextPayDate([1], '2026-11-30'), '2026-12-01');
  assert.equal(nextPayDate([31], '2026-11-30'), '2026-12-31', 'el día 31 de noviembre ya fue hoy');
});

test('sin fecha de corte, cuenta los compromisos del mes sin un gasto con su nombre', () => {
  const pending = pendingCommitments({
    commitments: [ARRIENDO, CELULAR],
    expenses: [gasto(350000, '2026-11-03', 'ARRIÉNDO de noviembre')],
    today: TODAY,
  });
  assert.deepEqual(pending.map((p) => p.name), ['Celular']);
});

test('con fecha de corte, cuenta los atrasados y lo que vence antes del pago, no ese día', () => {
  const list = (until, commitments) =>
    pendingCommitments({ commitments, expenses: [], today: TODAY, until }).map((p) => p.date);
  assert.deepEqual(list('2026-11-30', [ARRIENDO, CELULAR]), ['2026-11-20'], 'el arriendo se paga con el pago del 30');
  assert.deepEqual(list('2026-11-30', [{ ...CELULAR, dayOfMonth: 5 }]), ['2026-11-05'], 'atrasado');
  assert.deepEqual(list('2026-12-15', [{ ...CELULAR, dayOfMonth: 5 }]), ['2026-11-05', '2026-12-05'], 'también el del mes siguiente');
});

test('fecha fija: la estudiante con mesada puede gastar $10.000 al día', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'fecha_fija', payDays: [1], balance: 180000 },
    commitments: [{ id: 'p', name: 'Plan', amount: 30000, dayOfMonth: 25 }],
    changes: NO_CHANGES,
    movements: [],
    today: TODAY,
  });
  assert.equal(plan.mode, 'daily');
  assert.equal(plan.free, 150000);
  assert.equal(plan.days, 15);
  assert.equal(plan.perDay, 10000);
  assert.equal(plan.nextPay, '2026-12-01');
  assert.equal(plan.shortfall, 0);
});

test('fecha fija: si no alcanza, dice cuánto falta y no da un monto por día', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'fecha_fija', payDays: [30], balance: 200000 },
    commitments: [{ ...ARRIENDO, dayOfMonth: 25 }],
    changes: NO_CHANGES,
    movements: [],
    today: TODAY,
  });
  assert.equal(plan.perDay, 0);
  assert.equal(plan.shortfall, 150000);
});

test('sin fecha fija: el domiciliario necesita hacer $45.400 al día', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'sin_fecha', payDays: [], balance: 320000 },
    commitments: [{ ...ARRIENDO, dayOfMonth: 30 }, { ...CELULAR, dayOfMonth: 20 }],
    changes: NO_CHANGES,
    movements: [...dailyExpenses(40000), ingreso(38000, TODAY)],
    today: TODAY,
  });
  assert.equal(plan.mode, 'goal');
  assert.equal(plan.days, 14);
  assert.equal(plan.goal, 45400);
  assert.equal(plan.until, 'Arriendo');
  assert.equal(plan.todayIncome, 38000);
});

test('sin fecha fija: la plata que no ha entrado nunca reduce lo que debe', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'sin_fecha', payDays: [], balance: 100000 },
    commitments: [ARRIENDO],
    changes: NO_CHANGES,
    movements: [ingreso(60000, '2026-11-01'), ingreso(60000, '2026-11-15')],
    today: TODAY,
  });
  assert.equal(plan.free, -250000);
  assert.equal(plan.shortfall, 250000);
});

test('sin fecha fija: si ya cubre todo, dice para cuántos días le alcanza', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'sin_fecha', payDays: [], balance: 500000 },
    commitments: [],
    changes: NO_CHANGES,
    movements: dailyExpenses(40000),
    today: TODAY,
  });
  assert.equal(plan.mode, 'runway');
  assert.equal(plan.runwayDays, 12);
  assert.equal(plan.hasCommitments, false);
});

test('sin historial suficiente no habla de ritmo', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'sin_fecha', payDays: [], balance: 500000 },
    commitments: [],
    changes: NO_CHANGES,
    movements: [gasto(10000, TODAY)],
    today: TODAY,
  });
  assert.equal(plan.pace, null);
  assert.equal(plan.runwayDays, null);
  assert.equal(plan.free, 500000);
});

test('el ritmo no cuenta compromisos, fijos, ahorro ni compras grandes', () => {
  const { pace } = dailyRhythm({
    movements: [
      ...dailyExpenses(10000),
      gasto(350000, TODAY, 'Arriendo', 'otros'),
      gasto(90000, TODAY, 'Luz', 'servicios_publicos'),
      gasto(100000, TODAY, 'Ahorro', 'ahorro_inversion'),
      gasto(1000000, TODAY, 'Ropa', 'ropa'),
    ],
    commitments: [ARRIENDO],
    today: TODAY,
  });
  assert.equal(pace, 10000);
});

test('la plata actual suma y resta lo registrado después del saldo', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'sin_fecha', payDays: [], balance: 100000 },
    commitments: [],
    changes: { income: 50000, expense: 20000 },
    movements: [],
    today: TODAY,
  });
  assert.equal(plan.money, 130000);
});

test('sin perfil, tipo de ingreso o saldo no calcula nada', () => {
  const build = (profile) => buildMoneyPlan({ profile, commitments: [], changes: NO_CHANGES, movements: [], today: TODAY });
  assert.deepEqual(build(null), { ready: false });
  assert.deepEqual(build({ incomeType: null, payDays: [], balance: 100 }), { ready: false });
  assert.deepEqual(build({ incomeType: 'sin_fecha', payDays: [], balance: null }), { ready: false });
});

test('un saldo de 0 sí es un saldo', () => {
  const plan = buildMoneyPlan({
    profile: { incomeType: 'sin_fecha', payDays: [], balance: 0 },
    commitments: [],
    changes: NO_CHANGES,
    movements: [],
    today: TODAY,
  });
  assert.equal(plan.ready, true);
});
