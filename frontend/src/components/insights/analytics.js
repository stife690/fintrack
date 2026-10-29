import { formatMoney } from '@/components/transactions/format';

/**
 * Número con a lo sumo un decimal y coma decimal, como se escribe en Colombia (17,5).
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

/** Nombre y tono de cada nivel del puntaje de salud financiera. */
export const LEVELS = {
  excellent: { label: 'Excelente', tone: 'positive' },
  good: { label: 'Bien', tone: 'positive' },
  attention: { label: 'Atención', tone: 'caution' },
  risk: { label: 'En riesgo', tone: 'negative' },
};

/**
 * Nombre de cada parte del puntaje y frase con su dato.
 * @param {{ key: string, value: number|null }} part
 * @returns {{ label: string, detail: string }}
 */
export function describePart({ key, value }) {
  switch (key) {
    case 'savings':
      return {
        label: 'Ahorro',
        detail: value === null ? 'Aún no hay ingresos este mes' : `Ahorras el ${formatNumber(value)} % de tus ingresos`,
      };
    case 'budgets':
      return {
        label: 'Presupuestos',
        detail: value === null ? 'Crea presupuestos para sumar aquí' : `${value} sin pasarse del límite`,
      };
    case 'stability':
      return {
        label: 'Estabilidad',
        detail:
          value === null
            ? 'Falta historial de meses anteriores'
            : value <= 0
              ? `Gastas ${formatNumber(Math.abs(value))} % menos que tu promedio`
              : `Gastas ${formatNumber(value)} % más que tu promedio`,
      };
    default:
      return { label: 'Gastos hormiga', detail: `${formatNumber(value)} % de tu gasto` };
  }
}

/**
 * Frase de la proyección de fin de mes.
 * @param {import('@/services/analyticsService').Analytics['projection']} projection
 * @returns {string}
 */
export function projectionMessage({ available, projected, expectedIncome, balance }) {
  if (!available) return 'Desde el día 3 del mes te mostramos cuánto gastarás al cierre.';
  if (expectedIncome === 0) return `Al ritmo actual cerrarás el mes con ${formatMoney(projected)} en gastos.`;
  if (balance >= 0) {
    return `Al ritmo actual cerrarás el mes con ${formatMoney(projected)} en gastos: te sobrarían ${formatMoney(balance)}.`;
  }
  return `Al ritmo actual cerrarás el mes con ${formatMoney(projected)} en gastos: te faltarían ${formatMoney(-balance)}.`;
}

/**
 * Frase de los gastos hormiga.
 * @param {import('@/services/analyticsService').Analytics['smallExpenses']} small
 * @returns {string}
 */
export function smallExpensesMessage({ threshold, count, total, share, yearly, flagged }) {
  const limit = formatMoney(threshold);
  if (count === 0) return `Este mes no tienes gastos de ${limit} o menos.`;
  if (!flagged) return `Solo ${count} ${count === 1 ? 'gasto' : 'gastos'} de ${limit} o menos: vas bien.`;
  return `${count} gastos de ${limit} o menos suman ${formatMoney(total)} (${formatNumber(share)} % de tu gasto). A este ritmo serían ${formatMoney(yearly)} en un año.`;
}
