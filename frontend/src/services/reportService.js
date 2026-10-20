/**
 * Exportación de movimientos, según `docs/api/openapi.yaml` (`GET /reports/export`, FT-0012).
 */
import { authFetch } from '@/lib/authFetch';
import { CONNECTION_ERROR, toApiError } from '@/lib/apiRequest';

/**
 * Saca el nombre del archivo de `Content-Disposition: attachment; filename="fintrack_2026-10.csv"`.
 * @param {string|null} header
 * @param {string} fallback Nombre si el encabezado no llega (p. ej. un proxy lo quitó).
 * @returns {string}
 */
export function filenameFrom(header, fallback) {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

/**
 * Pide el archivo de exportación del periodo.
 * @param {{ format: 'csv'|'pdf', from: string, to: string }} options Fechas AAAA-MM-DD.
 * @returns {Promise<{ blob: Blob, filename: string }>}
 * @throws {Error} Con `code` (`NO_DATA` si no hay movimientos en el periodo, REQ-033).
 */
export async function exportTransactions({ format, from, to }) {
  const query = new URLSearchParams({ format, from, to });
  let res;
  try {
    res = await authFetch(`/reports/export?${query}`);
  } catch {
    throw new Error(CONNECTION_ERROR);
  }
  if (!res.ok) throw await toApiError(res);

  return {
    blob: await res.blob(),
    filename: filenameFrom(res.headers.get('Content-Disposition'), `fintrack_${from}_${to}.${format}`),
  };
}
