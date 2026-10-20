import { exportTransactions } from '../services/reports.service.js';
import { parseExportQuery } from '../validators/reports.validator.js';

/**
 * `GET /api/v1/reports/export?format=csv&from=AAAA-MM-DD&to=AAAA-MM-DD`: descarga los movimientos
 * del periodo como archivo (FT-0012). Responde 200 con el archivo adjunto, o 422 `NO_DATA`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getExport(req, res) {
  const query = parseExportQuery(req.query);
  const file = await exportTransactions(req.userId, query);
  res
    .set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      // Datos financieros personales: que ningún navegador ni proxy guarde una copia.
      'Cache-Control': 'no-store',
    })
    .send(file.body);
}
