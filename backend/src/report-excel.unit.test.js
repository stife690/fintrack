import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { daysBetween, isWholeMonth, summarize } from './services/report-data.service.js';
import { buildWorkbook } from './services/report-excel.service.js';
import { parseExportQuery } from './validators/reports.validator.js';

/**
 * Movimiento de prueba con valores por defecto.
 * @param {object} overrides Campos a cambiar.
 * @returns {object}
 */
const tx = (overrides) => ({
  date: '2026-10-10',
  type: 'gasto',
  categoryName: 'Alimentación',
  description: 'Gasto',
  amount: 1000,
  source: 'manual',
  ...overrides,
});

const OCT = { from: '2026-10-01', to: '2026-10-31', today: '2026-10-20' };

// ---------------------------------------------------------------- fechas

test('isWholeMonth reconoce meses completos, incluido febrero bisiesto', () => {
  assert.equal(isWholeMonth('2026-10-01', '2026-10-31'), true);
  assert.equal(isWholeMonth('2028-02-01', '2028-02-29'), true);
  assert.equal(isWholeMonth('2026-02-01', '2026-02-29'), false, '2026 no es bisiesto');
  assert.equal(isWholeMonth('2026-10-02', '2026-10-31'), false);
  assert.equal(isWholeMonth('2026-10-01', '2026-11-30'), false);
});

test('daysBetween cuenta ambos extremos', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-01'), 1);
  assert.equal(daysBetween('2026-10-01', '2026-10-31'), 31);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 2);
});

// ---------------------------------------------------------------- cálculos

test('summarize calcula ingresos, gastos, balance y tasa de ahorro sin residuos de decimales', () => {
  const s = summarize(
    [tx({ amount: 0.1 }), tx({ amount: 0.2 }), tx({ type: 'ingreso', categoryName: 'Salario', amount: 1 })],
    OCT,
  );
  assert.equal(s.totals.expense, 0.3, 'no 0.30000000000000004');
  assert.equal(s.totals.income, 1);
  assert.equal(s.totals.balance, 0.7);
  assert.equal(s.totals.savingsRate, 0.7);
  assert.equal(s.totals.count, 3);
});

test('summarize deja la tasa de ahorro en null si no hubo ingresos', () => {
  assert.equal(summarize([tx({})], OCT).totals.savingsRate, null);
});

test('el promedio diario solo cuenta los días que ya pasaron', () => {
  const s = summarize([tx({ amount: 2000 })], OCT); // hoy es 20 de octubre
  assert.equal(s.totals.daysElapsed, 20);
  assert.equal(s.totals.dailyAverageExpense, 100);
  const past = summarize([tx({ amount: 3100 })], { ...OCT, today: '2026-12-01' });
  assert.equal(past.totals.daysElapsed, 31, 'un mes ya terminado cuenta todos sus días');
});

test('summarize agrupa por categoría de mayor a menor con su participación', () => {
  const s = summarize(
    [
      tx({ categoryName: 'Transporte', amount: 250 }),
      tx({ categoryName: 'Vivienda', amount: 500 }),
      tx({ categoryName: 'Transporte', amount: 250 }),
      tx({ categoryName: null, amount: 1000 }),
    ],
    OCT,
  );
  assert.deepEqual(
    s.expenseByCategory.map((c) => [c.name, c.amount, c.count, c.share]),
    [
      ['Sin clasificar', 1000, 1, 0.5],
      ['Transporte', 500, 2, 0.25],
      ['Vivienda', 500, 1, 0.25],
    ],
    'a igual monto se conserva el orden de aparición',
  );
});

test('el top de gastos trae los 5 más grandes y desempata por fecha', () => {
  const rows = [10, 70, 30, 70, 50, 20, 60].map((amount, i) =>
    tx({ amount, description: `g${i}`, date: `2026-10-${String(10 + i).padStart(2, '0')}` }),
  );
  rows.push(tx({ type: 'ingreso', amount: 999, categoryName: 'Salario' }));
  const top = summarize(rows, OCT).topExpenses;
  assert.deepEqual(
    top.map((t) => t.description),
    ['g1', 'g3', 'g6', 'g4', 'g2'],
    'los ingresos no entran y a igual monto va primero el más antiguo',
  );
});

test('summarize separa los totales por mes', () => {
  const s = summarize(
    [
      tx({ date: '2026-09-30', amount: 100 }),
      tx({ date: '2026-10-01', amount: 40 }),
      tx({ date: '2026-10-02', type: 'ingreso', categoryName: 'Salario', amount: 500 }),
    ],
    { from: '2026-09-01', to: '2026-10-31', today: '2026-11-15' },
  );
  assert.deepEqual(s.byMonth, [
    { month: '2026-09', income: 0, expense: 100, balance: -100 },
    { month: '2026-10', income: 500, expense: 40, balance: 460 },
  ]);
});

// ---------------------------------------------------------------- libro de Excel

/**
 * Reporte completo de prueba, como lo devuelve buildReport.
 * @param {{ from?: string, to?: string, rows?: object[], budgets?: object[] }} [options]
 * @returns {object}
 */
function sampleReport({ from = '2026-10-01', to = '2026-10-31', rows, budgets = [] } = {}) {
  const data = rows ?? [
    tx({ date: '2026-10-02', type: 'ingreso', categoryName: 'Salario', description: 'Pago', amount: 350000 }),
    tx({ date: '2026-10-05', description: '=HYPERLINK("http://x")', amount: 18000 }),
    tx({ date: '2026-10-07', categoryName: 'Transporte', description: 'Bus', amount: 2950 }),
  ];
  return {
    period: { from, to, wholeMonth: isWholeMonth(from, to) },
    owner: { name: 'María', email: 'maria@example.com' },
    generatedOn: '2026-10-20',
    ...summarize(data, { from, to, today: '2026-10-20' }),
    budgets,
    rows: data,
  };
}

/**
 * Arma el libro y lo vuelve a leer, como lo haría Excel.
 * @param {object} report
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function roundTrip(report) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbook(report));
  return workbook;
}

/**
 * Valor visible de una celda: el resultado si es fórmula, o el valor tal cual.
 * @param {ExcelJS.Cell} cell
 * @returns {unknown}
 */
const shown = (cell) => (cell.value && typeof cell.value === 'object' && 'formula' in cell.value ? cell.value.result : cell.value);

test('el libro tiene Resumen y Movimientos, en ese orden', async () => {
  const wb = await roundTrip(sampleReport());
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ['Resumen', 'Movimientos'],
  );
});

test('los indicadores del resumen son fórmulas sobre Movimientos con el resultado ya calculado', async () => {
  const ws = (await roundTrip(sampleReport())).getWorksheet('Resumen');
  assert.match(ws.getCell('B5').value.formula, /^SUM\(Movimientos!\$E\$2:\$E\$4\)$/);
  assert.equal(shown(ws.getCell('B5')), 350000);
  assert.equal(shown(ws.getCell('B6')), 20950);
  assert.equal(ws.getCell('B7').value.formula, 'B5-B6');
  assert.equal(shown(ws.getCell('B7')), 329050);
  assert.equal(ws.getCell('B5').numFmt, '"$" #,##0;[Red]-"$" #,##0');
});

test('Movimientos separa ingreso y gasto y su total respeta los filtros', async () => {
  const ws = (await roundTrip(sampleReport())).getWorksheet('Movimientos');
  assert.deepEqual(ws.getRow(1).values.slice(1), ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Ingreso', 'Gasto', 'Origen']);
  assert.equal(ws.getCell('E2').value, 350000);
  assert.equal(ws.getCell('F2').value, null);
  assert.equal(ws.getCell('F5').value.formula, 'SUBTOTAL(109,F2:F4)');
  assert.ok(ws.getCell('A2').value instanceof Date, 'las fechas son fechas de Excel, no texto');
});

test('una descripción que empieza por = queda como texto, no como fórmula', async () => {
  const ws = (await roundTrip(sampleReport())).getWorksheet('Movimientos');
  assert.equal(ws.getCell('B3').value, '=HYPERLINK("http://x")');
  assert.equal(ws.getCell('B3').type, ExcelJS.ValueType.String);
});

test('el resumen incluye el top de gastos y los presupuestos con su estado', async () => {
  const report = sampleReport({
    budgets: [{ category: 'Transporte', limit: 2000, spent: 2950, available: -950, usage: 1.475, level: 'exceeded_100' }],
  });
  const ws = (await roundTrip(report)).getWorksheet('Resumen');
  const texts = [];
  ws.eachRow((row) => row.eachCell((cell) => typeof cell.value === 'string' && texts.push(cell.value)));
  assert.ok(texts.includes('Top 2 gastos más grandes'));
  assert.ok(texts.includes('1. =HYPERLINK("http://x")'));
  assert.ok(texts.includes('Presupuestos de octubre de 2026'));
  assert.ok(texts.includes('Excedido'));
});

test('la hoja Por mes aparece solo si el periodo abarca varios meses', async () => {
  const twoMonths = sampleReport({
    from: '2026-09-01',
    to: '2026-10-31',
    rows: [tx({ date: '2026-09-15', amount: 100 }), tx({ date: '2026-10-15', amount: 300 })],
  });
  const wb = await roundTrip(twoMonths);
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ['Resumen', 'Movimientos', 'Por mes'],
  );
  const ws = wb.getWorksheet('Por mes');
  assert.equal(ws.getCell('A2').value, 'Septiembre de 2026');
  assert.equal(shown(ws.getCell('C3')), 300);
});

// ---------------------------------------------------------------- validador

test('parseExportQuery acepta xlsx', () => {
  assert.equal(parseExportQuery({ format: 'xlsx', from: '2026-10-01', to: '2026-10-31' }).format, 'xlsx');
});
