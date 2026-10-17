import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetStatus } from './services/budgets.service.js';
import {
  parseBudgetAmount,
  parseMonthQuery,
  parseNewBudget,
} from './validators/budgets.validator.js';

/**
 * Comprueba que `fn` lance un AppError con ese código HTTP y, si se indican, esos campos en `details`.
 * @param {() => unknown} fn
 * @param {number} statusCode
 * @param {string[]} [fields]
 * @returns {void}
 */
function assertRejects(fn, statusCode, fields) {
  assert.throws(fn, (err) => {
    assert.equal(err.statusCode, statusCode);
    assert.equal(err.code, 'VALIDATION_ERROR');
    if (fields)
      assert.deepEqual(
        err.details.map((d) => d.field),
        fields,
      );
    return true;
  });
}
test('buildBudgetStatus aplica los umbrales del 80 % y el 100 % (RN-04)', () => {
  assert.equal(buildBudgetStatus(100, 0).alert.level, 'none');
  assert.equal(buildBudgetStatus(100, 79.99).alert.level, 'none');
  assert.equal(buildBudgetStatus(100, 80).alert.level, 'warning_80');
  assert.equal(buildBudgetStatus(100, 99.99).alert.level, 'warning_80');
  assert.equal(buildBudgetStatus(100, 100).alert.level, 'exceeded_100');
  assert.equal(buildBudgetStatus(80000, 85000).alert.level, 'exceeded_100');
});

test('buildBudgetStatus redondea el porcentaje a 2 decimales', () => {
  assert.deepEqual(buildBudgetStatus(3, 2), {
    percentage: 66.67,
    alert: { level: 'none', percentage: 66.67 },
  });
  assert.equal(buildBudgetStatus(80000, 85000).percentage, 106.25);
});
test('parseNewBudget devuelve los datos limpios', () => {
  assert.deepEqual(
    parseNewBudget({ category: ' alimentacion ', month: '2026-10', amount: 100000.567 }),
    { category: 'alimentacion', month: '2026-10', amount: 100000.57 },
  );
});

test('parseNewBudget reúne todos los problemas en un solo 422', () => {
  assertRejects(() => parseNewBudget({ category: '', month: 'octubre', amount: -5 }), 422, [
    'category',
    'month',
    'amount',
  ]);
});

test('parseNewBudget exige un mes real con formato AAAA-MM', () => {
  for (const month of ['2026-13', '2026-00', '2026-1', '26-10', '2026-10-15', 202610]) {
    assertRejects(() => parseNewBudget({ category: 'alimentacion', month, amount: 1 }), 422, [
      'month',
    ]);
  }
});

test('parseNewBudget exige un monto numérico, positivo y que quepa en la columna', () => {
  for (const amount of ['1000', 0, -1, Infinity, Number.NaN, 1e13, 0.001, undefined]) {
    assertRejects(
      () => parseNewBudget({ category: 'alimentacion', month: '2026-10', amount }),
      422,
      ['amount'],
    );
  }
});
test('un cuerpo que no es un objeto responde 400', () => {
  for (const body of [null, undefined, [1, 2], 'texto', 42]) {
    assertRejects(() => parseNewBudget(body), 400);
    assertRejects(() => parseBudgetAmount(body), 400);
  }
});

test('parseBudgetAmount valida solo el monto', () => {
  assert.equal(parseBudgetAmount({ amount: 250000, category: 'se-ignora' }), 250000);
  assertRejects(() => parseBudgetAmount({}), 422, ['amount']);
});

test('parseMonthQuery acepta que falte el mes y rechaza formatos inválidos', () => {
  assert.equal(parseMonthQuery({}), undefined);
  assert.equal(parseMonthQuery({ month: '2026-10' }), '2026-10');
  assertRejects(() => parseMonthQuery({ month: 'octubre' }), 422, ['month']);
  assertRejects(() => parseMonthQuery({ month: ['2026-10', '2026-11'] }), 422, ['month']);
});