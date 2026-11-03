/**
 * Lógica de la pantalla Calendario (FT-0025), separada de la vista para poder probarla.
 * Los eventos vienen de `GET /money-profile/calendar` (ver `moneyProfileService`).
 */

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Filtros de la pantalla: `mios` son los pagos propios y los días de pago. */
export const FILTERS = [
  { id: 'todo', label: 'Todo' },
  { id: 'mios', label: 'Míos' },
  { id: 'vacas', label: 'Vacas' },
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
 * @template {{ kind: string }} T
 * @param {T[]} events
 * @param {'todo'|'mios'|'vacas'} filter
 * @returns {T[]}
 */
export function filterEvents(events, filter) {
  if (filter === 'vacas') return events.filter((e) => e.kind === 'vaca');
  if (filter === 'mios') return events.filter((e) => e.kind !== 'vaca');
  return events;
}

/**
 * Monto corto para la cuadrícula: `89 mil`, `1,2 M`.
 * @param {number} amount
 * @returns {string}
 */
export function shortMoney(amount) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)} mil`;
  return String(Math.round(amount));
}

/** Lo más grave de un día manda en su color. */
const TONE_ORDER = ['negativo', 'riesgo', 'pago', 'ingreso'];

/**
 * Tono de un evento en la cuadrícula: el riesgo si lo tiene, si no si es pago o día de pago.
 * @param {{ kind: string, status: string|null, risk: string|null }} event
 * @returns {'negativo'|'riesgo'|'pago'|'ingreso'|null} `null` si ya está pagado.
 */
function toneOf(event) {
  if (event.kind === 'ingreso') return 'ingreso';
  if (event.status === 'pagado') return null;
  if (event.risk === 'negativo' || event.risk === 'riesgo') return event.risk;
  return 'pago';
}

/**
 * Celdas del mes empezando en lunes. Las primeras son `null` hasta el día 1.
 * @param {string} month AAAA-MM
 * @param {Array<{ date: string, kind: string, amount: number|null, status: string|null, risk: string|null }>} events
 * @param {string} today AAAA-MM-DD
 * @returns {Array<null|{ day: number, date: string, isToday: boolean, isPast: boolean, total: number, tone: string|null }>}
 */
export function calendarCells(month, events, today) {
  const [year, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  // getUTCDay: 0 es domingo; la semana empieza el lunes.
  const blanks = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: blanks }, () => null);
  for (let day = 1; day <= days; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const ofDay = events.filter((e) => e.date === date);
    const tones = ofDay.map(toneOf).filter(Boolean);
    cells.push({
      day,
      date,
      isToday: date === today,
      isPast: date < today,
      total: ofDay
        .filter((e) => e.kind !== 'ingreso' && e.status !== 'pagado')
        .reduce((acc, e) => acc + e.amount, 0),
      tone: TONE_ORDER.find((t) => tones.includes(t)) ?? null,
    });
  }
  return cells;
}

/**
 * Agrupa los eventos por fecha, en orden.
 * @template {{ date: string }} T
 * @param {T[]} events Ya ordenados por fecha.
 * @returns {Array<{ date: string, events: T[] }>}
 */
export function groupByDate(events) {
  const groups = [];
  for (const event of events) {
    const last = groups.at(-1);
    if (last?.date === event.date) last.events.push(event);
    else groups.push({ date: event.date, events: [event] });
  }
  return groups;
}

/** Texto del estado de un pago. */
export const STATUS_TEXT = {
  pagado: 'Pagado',
  pendiente: 'Por pagar',
  atrasado: 'Atrasado',
  sin_registro: 'Sin registro',
};
