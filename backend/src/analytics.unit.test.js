import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnalyticsService,
  dailySpending,
  daysInMonth,
  healthLevel,
  healthScore,
  linearPoints,
  normalizeDescription,
  projectMonth,
  shiftMonth,
  smallExpenses,
} from './services/analytics.service.js';

const gasto = (amount, category, description = 'Gasto', date = '2026-10-05') => ({
  amount,
  category,
  description,
  type: 'gasto',
  date,
});
const ingreso = (amount, date = '2026-10-01') => ({
  amount,
  category: 'salario',
  description: 'Salario',
  type: 'ingreso',
  date,
});

test('daysInMonth y shiftMonth manejan febrero y el cambio de año', () => {
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(daysInMonth('2026-10'), 31);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-10', -3), '2026-07');
});

test('proyección: los fijos cuentan una vez y los variables siguen el ritmo diario', () => {
  // Día 10 de 30: arriendo de 1.000.000 y 200.000 variables → 1.000.000 + 20.000 × 30.
  const result = projectMonth({
    current: [gasto(1_000_000, 'vivienda'), gasto(200_000, 'alimentacion'), ingreso(3_000_000)],
    previous: [],
    day: 10,
    days: 30,
  });
  assert.deepEqual(result, {
    available: true,
    spent: 1_200_000,
    projected: 1_600_000,
    pendingFixed: 0,
    expectedIncome: 3_000_000,
    balance: 1_400_000,
  });
});

test('proyección: un fijo del mes pasado que aún no se paga se suma como pendiente', () => {
  const result = projectMonth({
    current: [gasto(100_000, 'alimentacion')],
    previous: [
      gasto(900_000, 'vivienda', 'Arriendo', '2026-09-01'),
      ingreso(2_500_000, '2026-09-30'),
    ],
    day: 5,
    days: 30,
  });
  assert.equal(result.pendingFixed, 900_000);
  assert.equal(result.projected, 900_000 + 600_000);
  // Sin ingresos este mes todavía, se esperan los del mes pasado.
  assert.equal(result.expectedIncome, 2_500_000);
});

test('proyección: los primeros días no está disponible', () => {
  const result = projectMonth({
    current: [gasto(50_000, 'alimentacion')],
    previous: [],
    day: 2,
    days: 31,
  });
  assert.equal(result.available, false);
});

test('normalizeDescription ignora tildes, mayúsculas y espacios', () => {
  assert.equal(normalizeDescription('  Café   con LECHE '), 'cafe con leche');
});

test('gastos hormiga: cuenta los de $20.000 o menos y agrupa los repetidos', () => {
  const current = [
    gasto(5_000, 'alimentacion', 'Café'),
    gasto(6_000, 'alimentacion', 'cafe '),
    gasto(4_000, 'alimentacion', 'CAFÉ'),
    gasto(20_000, 'transporte', 'Taxi'),
    gasto(15_000, 'transporte', 'Taxi'),
    gasto(20_001, 'alimentacion', 'Almuerzo'),
    gasto(930_000, 'vivienda', 'Arriendo'),
    ingreso(10_000),
  ];
  const result = smallExpenses({ current, day: 10, days: 30 });
  assert.equal(result.count, 5);
  assert.equal(result.total, 50_000);
  assert.equal(result.share, 5); // 50.000 de 1.000.001
  assert.equal(result.yearly, 50_000 * 3 * 12);
  assert.equal(result.flagged, true);
  assert.deepEqual(result.top, [
    { description: 'Café', count: 3, total: 15_000 },
    { description: 'Taxi', count: 2, total: 35_000 },
  ]);
});

test('gastos hormiga: con menos de 5 no avisa', () => {
  const result = smallExpenses({
    current: [gasto(5_000, 'alimentacion', 'Café')],
    day: 3,
    days: 30,
  });
  assert.equal(result.flagged, false);
  assert.deepEqual(result.top, []);
});

test('linearPoints da 25 en lo mejor, 0 en lo peor y una recta en medio', () => {
  assert.equal(linearPoints(20, 20, 0), 25);
  assert.equal(linearPoints(35, 20, 0), 25);
  assert.equal(linearPoints(10, 20, 0), 12.5);
  assert.equal(linearPoints(-5, 20, 0), 0);
  // Escala invertida: menos es mejor.
  assert.equal(linearPoints(12.5, 5, 20), 12.5);
});

test('healthLevel pone los cortes en 80, 60 y 40', () => {
  assert.equal(healthLevel(80), 'excellent');
  assert.equal(healthLevel(79), 'good');
  assert.equal(healthLevel(40), 'attention');
  assert.equal(healthLevel(39), 'risk');
});

test('puntaje: finanzas sanas suman 100', () => {
  const result = healthScore({
    income: 3_000_000,
    expense: 2_000_000, // ahorra 33 %
    budgets: [{ percentage: 50 }, { percentage: 90 }],
    previousExpenses: [2_100_000, 2_000_000, 0],
    smallShare: 3,
  });
  assert.equal(result.score, 100);
  assert.equal(result.level, 'excellent');
});

test('puntaje: cada parte se calcula por separado', () => {
  const result = healthScore({
    income: 2_000_000,
    expense: 1_800_000, // ahorra 10 % → 12,5
    budgets: [{ percentage: 120 }, { percentage: 40 }], // 1 de 2 → 12,5
    previousExpenses: [1_500_000], // +20 % → 8,3
    smallShare: 20, // → 0
  });
  assert.deepEqual(
    result.parts.map((p) => [p.key, p.points, p.value]),
    [
      ['savings', 12.5, 10],
      ['budgets', 12.5, 1],
      ['stability', 8.3, 20],
      ['small_expenses', 0, 20],
    ],
  );
  assert.equal(result.score, 33);
  assert.equal(result.level, 'risk');
});

test('puntaje: sin ingresos, presupuestos ni historial', () => {
  const result = healthScore({
    income: 0,
    expense: 100_000,
    budgets: [],
    previousExpenses: [0, 0, 0],
    smallShare: 0,
  });
  assert.deepEqual(
    result.parts.map((p) => [p.key, p.points, p.value]),
    [
      ['savings', 0, null],
      ['budgets', 12.5, null],
      ['stability', 12.5, null],
      ['small_expenses', 25, 0],
    ],
  );
  assert.equal(result.score, 50);
});

test('getAnalytics pide 3 meses atrás hasta hoy y arma la respuesta', async () => {
  const calls = [];
  const service = createAnalyticsService({
    now: () => new Date('2026-10-10T15:00:00Z'),
    listMovements: async (userId, range) => {
      calls.push({ userId, range });
      return [
        gasto(1_000_000, 'vivienda', 'Arriendo', '2026-10-01'),
        gasto(200_000, 'alimentacion', 'Mercado', '2026-10-03'),
        ingreso(3_000_000, '2026-10-01'),
        gasto(1_400_000, 'alimentacion', 'Mercado', '2026-09-15'),
        gasto(999, 'otros', 'Viejo', '2026-07-01'),
      ];
    },
    listBudgets: async () => [{ percentage: 30 }],
  });
  const result = await service.getAnalytics('u1');
  assert.deepEqual(calls, [{ userId: 'u1', range: { from: '2026-06-01', to: '2026-10-10' } }]);
  assert.equal(result.month, '2026-10');
  assert.equal(result.day, 10);
  assert.equal(result.daysInMonth, 31);
  assert.equal(result.empty, false);
  // 1.000.000 + 200.000 / 10 × 31
  assert.equal(result.projection.projected, 1_620_000);
  assert.equal(typeof result.health.score, 'number');
});

test('getAnalytics marca empty cuando el mes no tiene movimientos', async () => {
  const service = createAnalyticsService({
    now: () => new Date('2026-10-10T15:00:00Z'),
    listMovements: async () => [],
    listBudgets: async () => [],
  });
  const result = await service.getAnalytics('u1');
  assert.equal(result.empty, true);
  assert.equal(result.projection.projected, 0);
});

test('dailySpending acumula los gastos de cada día hasta hoy', () => {
  const current = [
    gasto(10_000, 'alimentacion', 'Almuerzo', '2026-10-01'),
    gasto(5_000, 'transporte', 'Bus', '2026-10-03'),
    gasto(2_000, 'transporte', 'Bus', '2026-10-03'),
    ingreso(900_000, '2026-10-02'),
  ];
  assert.deepEqual(dailySpending(current, 4), [
    { day: 1, total: 10_000 },
    { day: 2, total: 10_000 },
    { day: 3, total: 17_000 },
    { day: 4, total: 17_000 },
  ]);
});

test('getAnalytics trae la serie del mes y el puntaje del mes pasado', async () => {
  const budgetMonths = [];
  const service = createAnalyticsService({
    now: () => new Date('2026-10-03T15:00:00Z'),
    listMovements: async () => [
      gasto(30_000, 'alimentacion', 'Mercado', '2026-10-02'),
      ingreso(2_000_000, '2026-09-01'),
      gasto(1_500_000, 'alimentacion', 'Mercado', '2026-09-10'),
    ],
    listBudgets: async (userId, month) => {
      budgetMonths.push(month);
      return [];
    },
  });
  const result = await service.getAnalytics('u1');
  assert.deepEqual(budgetMonths, ['2026-10', '2026-09']);
  assert.deepEqual(result.daily, [
    { day: 1, total: 0 },
    { day: 2, total: 30_000 },
    { day: 3, total: 30_000 },
  ]);
  // Septiembre: ahorro 25 % → 25; sin presupuestos 12,5; sin historial 12,5; sin hormiga 25.
  assert.equal(result.previousScore, 75);
});

test('sin movimientos el mes pasado no hay puntaje para comparar', async () => {
  const service = createAnalyticsService({
    now: () => new Date('2026-10-10T15:00:00Z'),
    listMovements: async () => [gasto(1_000, 'otros', 'Algo', '2026-10-01')],
    listBudgets: async () => [],
  });
  assert.equal((await service.getAnalytics('u1')).previousScore, null);
});
