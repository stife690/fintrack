/**
 * Lógica de la pantalla Calendario (FT-0025), separada de la vista para poder probarla.
 * Los eventos vienen de `GET /money-profile/calendar` (ver `moneyProfileService`).
 */
import { monthCells } from '@/lib/calendar';

/** Filtros de la pantalla: `mios` son los pagos propios y los días de pago. */
export const FILTERS = [
  { id: 'todo', label: 'Todo' },
  { id: 'mios', label: 'Míos' },
  { id: 'vacas', label: 'Vacas' },
];

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
 * Celdas del mes con el total por pagar de cada día y su tono.
 * @param {string} month AAAA-MM
 * @param {Array<{ date: string, kind: string, amount: number|null, status: string|null, risk: string|null }>} events
 * @param {string} today AAAA-MM-DD
 * @returns {Array<null|{ day: number, date: string, isToday: boolean, isPast: boolean, total: number, tone: string|null }>}
 */
export function calendarCells(month, events, today) {
  return monthCells(month, today).map((cell) => {
    if (!cell) return null;
    const ofDay = events.filter((e) => e.date === cell.date);
    const tones = ofDay.map(toneOf).filter(Boolean);
    return {
      ...cell,
      total: ofDay
        .filter((e) => e.kind !== 'ingreso' && e.status !== 'pagado')
        .reduce((acc, e) => acc + e.amount, 0),
      tone: TONE_ORDER.find((t) => tones.includes(t)) ?? null,
    };
  });
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
