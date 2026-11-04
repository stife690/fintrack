/**
 * Lógica de la pestaña Calendario de una vaca (FT-0043), separada de la vista para probarla.
 * Usa lo que ya devuelve `getVaca`: los aportes (los últimos 50) y la fecha límite.
 */
import { monthCells } from '@/lib/calendar';

/**
 * Celdas del mes con lo aportado cada día y si es la fecha límite.
 * @param {string} month AAAA-MM
 * @param {string} today AAAA-MM-DD
 * @param {Array<{ date: string, amount: number }>} contributions
 * @param {string|null} deadline AAAA-MM-DD
 * @returns {Array<null|{ day: number, date: string, isToday: boolean, isPast: boolean, contributed: number, isDeadline: boolean }>}
 */
export function vacaCells(month, today, contributions, deadline) {
  return monthCells(month, today).map((cell) => {
    if (!cell) return null;
    const contributed = contributions
      .filter((c) => c.date === cell.date)
      .reduce((acc, c) => acc + c.amount, 0);
    return { ...cell, contributed, isDeadline: cell.date === deadline };
  });
}

/**
 * Aportes de un mes agrupados por día, del más reciente al más antiguo.
 * @template {{ date: string }} T
 * @param {T[]} contributions
 * @param {string} month AAAA-MM
 * @returns {Array<{ date: string, items: T[] }>}
 */
export function contributionsOfMonth(contributions, month) {
  const groups = new Map();
  for (const c of contributions) {
    if (!c.date.startsWith(month)) continue;
    if (!groups.has(c.date)) groups.set(c.date, []);
    groups.get(c.date).push(c);
  }
  return [...groups]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

/**
 * Mes que se muestra al abrir la pestaña: el actual, salvo que la vaca ya venció (entonces el de
 * la fecha límite, donde está lo último que pasó).
 * @param {string} today AAAA-MM-DD
 * @param {string|null} deadline
 * @returns {string} AAAA-MM
 */
export function initialMonth(today, deadline) {
  return deadline && deadline < today ? deadline.slice(0, 7) : today.slice(0, 7);
}
