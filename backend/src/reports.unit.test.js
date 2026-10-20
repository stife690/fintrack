import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCell, exportFilename, formatAmount, toCsv } from './services/reports.service.js';
import { parseExportQuery } from './validators/reports.validator.js';

/**
 * Comprueba que `fn` lance un 422 VALIDATION_ERROR con exactamente esos campos en `details`.
 * @param {() => unknown} fn
 * @param {string[]} fields
 * @returns {void}
 */
function assertInvalid(fn, fields) {
  assert.throws(fn, (err) => {
    assert.equal(err.statusCode, 422);
    assert.equal(err.code, 'VALIDATION_ERROR');
    assert.deepEqual(
      err.details.map((d) => d.field),
      fields,
    );
    return true;
  });
}

// ---------------------------------------------------------------- validador

test('parseExportQuery acepta csv y pdf y devuelve solo los campos conocidos', () => {
  assert.deepEqual(
    parseExportQuery({ format: 'csv', from: '2026-10-01', to: '2026-10-31', admin: 'true' }),
    { format: 'csv', from: '2026-10-01', to: '2026-10-31' },
  );
  assert.equal(parseExportQuery({ format: 'pdf', from: '2026-10-01', to: '2026-10-01' }).format, 'pdf');
});

test('parseExportQuery informa todos los campos inválidos a la vez', () => {
  assertInvalid(() => parseExportQuery({}), ['format', 'from', 'to']);
  assertInvalid(() => parseExportQuery({ format: 'xls', from: '2026-10-01', to: '2026-10-31' }), ['format']);
  assertInvalid(() => parseExportQuery({ format: ['csv', 'pdf'], from: '2026-10-01', to: '2026-10-31' }), [
    'format',
  ]);
});

test('parseExportQuery rechaza fechas que no existen o con otro formato', () => {
  assertInvalid(() => parseExportQuery({ format: 'csv', from: '2026-02-30', to: '2026-03-01' }), ['from']);
  assertInvalid(() => parseExportQuery({ format: 'csv', from: '2026-10-01', to: '31/10/2026' }), ['to']);
});

test('parseExportQuery exige que from no sea posterior a to', () => {
  assertInvalid(() => parseExportQuery({ format: 'csv', from: '2026-10-31', to: '2026-10-01' }), ['to']);
});

// ---------------------------------------------------------------- armado del CSV

test('escapeCell deja igual el texto simple', () => {
  assert.equal(escapeCell('Almuerzo en el centro'), 'Almuerzo en el centro');
});

test('escapeCell encierra entre comillas el texto con ; comillas o saltos de línea', () => {
  assert.equal(escapeCell('Pizza; gaseosa'), '"Pizza; gaseosa"');
  assert.equal(escapeCell('El "mejor" café'), '"El ""mejor"" café"');
  assert.equal(escapeCell('línea 1\nlínea 2'), '"línea 1\nlínea 2"');
});

test('escapeCell neutraliza fórmulas (inyección de CSV)', () => {
  for (const start of ['=', '+', '-', '@', '\t']) {
    assert.equal(escapeCell(`${start}SUMA(A1)`)[0], "'", `debe neutralizar ${JSON.stringify(start)}`);
  }
  assert.equal(escapeCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
});

test('formatAmount usa coma decimal solo si hay centavos y nunca separador de miles', () => {
  assert.equal(formatAmount(18000), '18000');
  assert.equal(formatAmount(25500.5), '25500,50');
  assert.equal(formatAmount(0.01), '0,01');
  assert.equal(formatAmount(1234567.89), '1234567,89');
});

test('toCsv arma BOM, encabezado y una línea por movimiento con etiquetas legibles', () => {
  const csv = toCsv([
    { date: '2026-10-17', type: 'gasto', categoryName: 'Alimentación', description: 'Almuerzo', amount: 18000, source: 'manual' },
    { date: '2026-10-18', type: 'ingreso', categoryName: null, description: 'Pago', amount: 50.5, source: 'sin_clasificar' },
  ]);
  assert.ok(csv.startsWith('﻿'), 'empieza con el BOM para que Excel lea UTF-8');
  assert.deepEqual(csv.slice(1).split('\r\n'), [
    'Fecha;Tipo;Categoría;Descripción;Monto;Origen',
    '2026-10-17;Gasto;Alimentación;Almuerzo;18000;Manual',
    '2026-10-18;Ingreso;Sin clasificar;Pago;50,50;Sin clasificar',
    '',
  ]);
});

test('exportFilename usa el mes cuando el rango es un mes completo', () => {
  assert.equal(exportFilename('2026-10-01', '2026-10-31', 'csv'), 'fintrack_2026-10.csv');
  assert.equal(exportFilename('2028-02-01', '2028-02-29', 'csv'), 'fintrack_2028-02.csv', 'año bisiesto');
  assert.equal(exportFilename('2026-10-01', '2026-10-30', 'csv'), 'fintrack_2026-10-01_2026-10-30.csv');
  assert.equal(exportFilename('2026-10-01', '2026-11-30', 'csv'), 'fintrack_2026-10-01_2026-11-30.csv');
});
