/**
 * Utilidades de los calendarios (pagos FT-0025 y vacas FT-0043): meses AAAA-MM, nombres en
 * español y las celdas de un mes. Las fechas se manejan como texto para no correrse por la zona horaria.
 */

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * @param {string} month AAAA-MM
 * @param {number} offset
 * @returns {string} AAAA-MM
 */
export function shiftMonth(month, offset) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** @returns {string} p. ej. `Noviembre 2026`. */
export function monthLabel(month) {
  const [year, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

/** @returns {string} p. ej. `12 nov`. */
export function dayLabel(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/**
 * Celdas del mes empezando en lunes. Las primeras son `null` hasta el día 1.
 * @param {string} month AAAA-MM
 * @param {string} today AAAA-MM-DD
 * @returns {Array<null|{ day: number, date: string, isToday: boolean, isPast: boolean }>}
 */
export function monthCells(month, today) {
  const [year, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  // getUTCDay: 0 es domingo; la semana empieza el lunes.
  const blanks = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: blanks }, () => null);
  for (let day = 1; day <= days; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    cells.push({ day, date, isToday: date === today, isPast: date < today });
  }
  return cells;
}
