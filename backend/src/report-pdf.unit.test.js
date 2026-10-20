import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWholeMonth, summarize } from './services/report-data.service.js';
import { buildPdf, pdfSafe } from './services/report-pdf.service.js';

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

/**
 * Reporte completo de prueba, como lo devuelve buildReport.
 * @param {object[]} rows
 * @param {{ from?: string, to?: string, budgets?: object[] }} [options]
 * @returns {object}
 */
function report(rows, { from = '2026-10-01', to = '2026-10-31', budgets = [] } = {}) {
  return {
    period: { from, to, wholeMonth: isWholeMonth(from, to) },
    owner: { name: 'María', email: 'maria@example.com' },
    generatedOn: '2026-10-20',
    ...summarize(rows, { from, to, today: '2026-10-20' }),
    budgets,
    rows,
  };
}

/**
 * Número de páginas de un PDF de pdfkit (cuenta los objetos de tipo página).
 * @param {Buffer} pdf
 * @returns {number}
 */
const pageCount = (pdf) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

// ---------------------------------------------------------------- texto

test('pdfSafe conserva tildes, ñ y signos del español', () => {
  assert.equal(pdfSafe('Café, niño ¿sí? ¡ya! — 50 € · “ok”'), 'Café, niño ¿sí? ¡ya! — 50 € · “ok”');
});

test('pdfSafe quita lo que Helvetica no puede dibujar', () => {
  assert.equal(pdfSafe('Almuerzo 🍕 con amigos'), 'Almuerzo con amigos');
  assert.equal(pdfSafe('Pago monitor�a'), 'Pago monitora');
  assert.equal(pdfSafe('日本 ramen'), 'ramen');
});

// ---------------------------------------------------------------- documento

test('buildPdf genera un PDF válido con su título', async () => {
  const pdf = await buildPdf(report([tx({}), tx({ type: 'ingreso', categoryName: 'Salario', amount: 5000 })]));
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.subarray(-8).toString(), /%%EOF/);
  assert.match(pdf.toString('latin1'), /Reporte de movimientos/, 'el título va en los metadatos');
  assert.equal(pageCount(pdf), 2, 'resumen y movimientos');
});

test('la tabla de movimientos continúa en más páginas cuando no cabe', async () => {
  const rows = Array.from({ length: 80 }, (_, i) => tx({ description: `Movimiento ${i + 1}`, amount: 1000 + i }));
  assert.ok(pageCount(await buildPdf(report(rows))) >= 3);
});

test('buildPdf funciona con varios meses, muchas categorías, presupuestos y sin ingresos', async () => {
  const categories = ['Alimentación', 'Transporte', 'Vivienda', 'Salud', 'Educación', 'Entretenimiento', 'Tecnología', 'Otros'];
  const rows = categories.map((categoryName, i) =>
    tx({ categoryName, date: `2026-${i % 2 ? '09' : '10'}-1${i}`, description: 'x'.repeat(200) }),
  );
  const pdf = await buildPdf(
    report(rows, {
      from: '2026-09-01',
      to: '2026-10-31',
      budgets: [{ category: 'Salud', limit: 500, spent: 1000, available: -500, usage: 2, level: 'exceeded_100' }],
    }),
  );
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});
