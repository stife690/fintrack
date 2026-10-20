import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors/app-error.js';
import { parseSummaryQuery } from './validators/transactions.validator.js';
import { createTransactionService, periodRange } from './services/transactions.service.js';

/**
 * Servicio con un repositorio falso que devuelve `rows` y guarda con qué se le llamó.
 * @param {{ byCategory: object[], series: object[] }} rows
 * @returns {{ service: ReturnType<typeof createTransactionService>, calls: object[] }}
 */
function serviceWith(rows) {
  const calls = [];
  const service = createTransactionService({
    repository: {
      summarizeTransactions: async (args) => {
        calls.push(args);
        return rows;
      },
    },
  });
  return { service, calls };
}

test('parseSummaryQuery acepta period y date válidos', () => {
  assert.deepEqual(parseSummaryQuery({ period: 'month', date: '2026-10-20' }), {
    period: 'month',
    date: '2026-10-20',
  });
});

test('parseSummaryQuery usa la fecha de hoy si no llega date', () => {
  const { date } = parseSummaryQuery({ period: 'week' });
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
});

test('parseSummaryQuery rechaza period y date inválidos con 422', () => {
  for (const [query, field] of [
    [{}, 'period'],
    [{ period: 'day' }, 'period'],
    [{ period: 'month', date: '2026-02-30' }, 'date'],
    [{ period: 'month', date: '20/10/2026' }, 'date'],
  ]) {
    assert.throws(
      () => parseSummaryQuery(query),
      (err) =>
        err instanceof AppError &&
        err.statusCode === 422 &&
        err.details.some((d) => d.field === field),
    );
  }
});

test('periodRange: la semana va de lunes a domingo, aunque cruce de mes o año', () => {
  // 2026-10-20 es martes.
  assert.deepEqual(periodRange('week', '2026-10-20'), { from: '2026-10-19', to: '2026-10-25' });
  // Un domingo pertenece a la semana que empezó el lunes anterior.
  assert.deepEqual(periodRange('week', '2026-10-25'), { from: '2026-10-19', to: '2026-10-25' });
  // 2027-01-01 es viernes: su semana empieza en diciembre de 2026.
  assert.deepEqual(periodRange('week', '2027-01-01'), { from: '2026-12-28', to: '2027-01-03' });
});

test('periodRange: mes completo (incluye febrero bisiesto) y año completo', () => {
  assert.deepEqual(periodRange('month', '2026-10-20'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(periodRange('month', '2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(periodRange('year', '2026-10-20'), { from: '2026-01-01', to: '2026-12-31' });
});

test('summary arma ingresos y gastos por categoría con porcentaje y une la serie por día', async () => {
  const { service, calls } = serviceWith({
    byCategory: [
      { type: 'ingreso', category: 'salario', total: 1500000 },
      { type: 'gasto', category: 'alimentacion', total: 300000 },
      { type: 'gasto', category: null, total: 100000.1 },
    ],
    series: [
      { date: '2026-10-01', type: 'ingreso', total: 1500000 },
      { date: '2026-10-01', type: 'gasto', total: 100000.1 },
      { date: '2026-10-05', type: 'gasto', total: 300000 },
    ],
  });

  const result = await service.summary('u1', { period: 'month', date: '2026-10-20' });

  assert.deepEqual(calls[0], {
    userId: 'u1',
    from: '2026-10-01',
    to: '2026-10-31',
    groupBy: 'day',
  });
  assert.deepEqual(result, {
    period: 'month',
    from: '2026-10-01',
    to: '2026-10-31',
    income: {
      total: 1500000,
      byCategory: [{ category: 'salario', total: 1500000, percentage: 100 }],
    },
    expense: {
      total: 400000.1,
      byCategory: [
        { category: 'alimentacion', total: 300000, percentage: 75 },
        { category: null, total: 100000.1, percentage: 25 },
      ],
    },
    timeSeries: [
      { date: '2026-10-01', income: 1500000, expense: 100000.1 },
      { date: '2026-10-05', income: 0, expense: 300000 },
    ],
  });
});

test('summary del año agrupa por mes', async () => {
  const { service, calls } = serviceWith({ byCategory: [], series: [] });
  await service.summary('u1', { period: 'year', date: '2026-10-20' });
  assert.equal(calls[0].groupBy, 'month');
});

test('summary sin transacciones devuelve ceros y listas vacías (REQ-015)', async () => {
  const { service } = serviceWith({ byCategory: [], series: [] });
  const result = await service.summary('u1', { period: 'week', date: '2026-10-20' });
  assert.deepEqual(result, {
    period: 'week',
    from: '2026-10-19',
    to: '2026-10-25',
    income: { total: 0, byCategory: [] },
    expense: { total: 0, byCategory: [] },
    timeSeries: [],
  });
});
