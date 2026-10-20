import { AppError } from '../errors/app-error.js';
import { listForExport } from '../repositories/transactions.repository.js';

/** Separador de columnas: con `;` Excel en español (coma decimal) abre cada dato en su columna. */
const SEPARATOR = ';';
/** Fin de línea del estándar CSV (RFC 4180). */
const NEWLINE = '\r\n';
/** Marca invisible al inicio para que Excel lea el archivo como UTF-8 (tildes y ñ). */
const BOM = '﻿';

const HEADER = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Origen'];
const TYPE_LABELS = { gasto: 'Gasto', ingreso: 'Ingreso' };
const SOURCE_LABELS = { manual: 'Manual', ia: 'IA', sin_clasificar: 'Sin clasificar' };

/**
 * Prepara un texto para una celda del CSV.
 * - Si empieza con `= + - @` (o tabulador / retorno), Excel lo ejecutaría como fórmula
 *   ("inyección de CSV"); se antepone un apóstrofo para que quede como texto.
 * - Si contiene el separador, comillas o saltos de línea, va entre comillas y las comillas
 *   internas se duplican, como pide el estándar.
 * @param {string} value
 * @returns {string}
 */
export function escapeCell(value) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Monto como número que Excel en español reconoce: sin `$` ni puntos de miles y con coma
 * decimal solo si tiene centavos (`18000`, `18000,50`).
 * @param {number} amount
 * @returns {string}
 */
export function formatAmount(amount) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');
}

/**
 * Arma el contenido completo del CSV a partir de los movimientos.
 * @param {Awaited<ReturnType<typeof listForExport>>} rows
 * @returns {string}
 */
export function toCsv(rows) {
  const lines = [HEADER.map(escapeCell).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        TYPE_LABELS[row.type],
        escapeCell(row.categoryName ?? 'Sin clasificar'),
        escapeCell(row.description),
        formatAmount(row.amount),
        SOURCE_LABELS[row.source],
      ].join(SEPARATOR),
    );
  }
  return BOM + lines.join(NEWLINE) + NEWLINE;
}

/**
 * Nombre del archivo: `fintrack_2026-10.csv` si el rango es un mes completo,
 * `fintrack_2026-10-01_2026-10-15.csv` en cualquier otro caso.
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @param {string} extension
 * @returns {string}
 */
export function exportFilename(from, to, extension) {
  const [year, month] = from.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // día 0 del mes siguiente
  const wholeMonth = from.endsWith('-01') && to === `${from.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
  const period = wholeMonth ? from.slice(0, 7) : `${from}_${to}`;
  return `fintrack_${period}.${extension}`;
}

/**
 * Genera el archivo de exportación del periodo (FT-0012, REQ-031 a REQ-033).
 * @param {string} userId
 * @param {{ format: 'csv'|'pdf', from: string, to: string }} query Datos ya validados.
 * @returns {Promise<{ filename: string, contentType: string, body: string }>}
 * @throws {AppError} 422 `NO_DATA` si no hay movimientos en el periodo; 422 si se pide PDF.
 */
export async function exportTransactions(userId, { format, from, to }) {
  if (format === 'pdf') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'format', problem: 'La exportación en PDF todavía no está disponible' },
    ]);
  }

  const rows = await listForExport({ userId, from, to });
  if (rows.length === 0) {
    throw new AppError(422, 'NO_DATA', 'No hay movimientos en el periodo seleccionado');
  }

  return {
    filename: exportFilename(from, to, 'csv'),
    contentType: 'text/csv; charset=utf-8',
    body: toCsv(rows),
  };
}
