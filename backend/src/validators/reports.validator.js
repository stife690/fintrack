import { AppError } from '../errors/app-error.js';
import { isValidDate } from './transactions.validator.js';

/** Formatos del contrato. El PDF está definido pero todavía no se genera. */
const FORMATS = ['xlsx', 'csv', 'pdf'];

/**
 * Valida la query de `GET /reports/export`: `?format=xlsx|csv&from=AAAA-MM-DD&to=AAAA-MM-DD`.
 * @param {Record<string, unknown>} query `req.query` de Express.
 * @returns {{ format: 'xlsx'|'csv'|'pdf', from: string, to: string }} Datos limpios.
 * @throws {AppError} 422 `VALIDATION_ERROR` con el problema de cada campo.
 */
export function parseExportQuery(query) {
  const details = [];
  const { format, from, to } = query;

  if (!FORMATS.includes(format)) {
    details.push({ field: 'format', problem: 'Debe ser xlsx, csv o pdf' });
  }
  if (!isValidDate(from)) {
    details.push({ field: 'from', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  if (!isValidDate(to)) {
    details.push({ field: 'to', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  // Las fechas AAAA-MM-DD se pueden comparar como texto: el orden alfabético es el cronológico.
  if (details.length === 0 && from > to) {
    details.push({ field: 'to', problem: 'Debe ser igual o posterior a from' });
  }

  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }
  return { format, from, to };
}
