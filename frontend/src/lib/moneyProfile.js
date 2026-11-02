/** Pagos que más se repiten, para no escribirlos en la bienvenida. */
export const SUGGESTED_COMMITMENTS = ['Arriendo', 'Internet', 'Celular', 'Transporte', 'Universidad', 'Cuota'];

/** Días de pago por mes que acepta la API. */
export const MAX_PAY_DAYS = 4;

/**
 * Elige o quita un día de pago. Si ya hay el máximo, no agrega más.
 * @param {number[]} days
 * @param {number} day
 * @returns {number[]} Días ordenados.
 */
export function togglePayDay(days, day) {
  if (days.includes(day)) return days.filter((d) => d !== day);
  if (days.length >= MAX_PAY_DAYS) return days;
  return [...days, day].sort((a, b) => a - b);
}

/**
 * Convierte lo escrito en el perfil que recibe la API. Lo que quedó sin responder va en `null`.
 * @param {{ incomeType: string, payDays: number[], balance: string }} form `balance` es el texto de `MoneyInput`.
 * @returns {{ incomeType: string|null, payDays: number[], balance: number|null }}
 */
export function toProfileData({ incomeType, payDays, balance }) {
  return {
    incomeType: incomeType || null,
    payDays: incomeType === 'fecha_fija' ? payDays : [],
    balance: balance === '' ? null : Number(balance),
  };
}

/**
 * Cuánta plata dicen tener los movimientos. Si solo hay gastos, o gastó más de lo registrado como
 * ingreso, no dicen nada útil y no se propone ningún número.
 * @param {{ income: number, expense: number }} totals
 * @returns {number|null}
 */
export function balanceProposal({ income, expense }) {
  const total = Math.round(income - expense);
  return total > 0 ? total : null;
}

/**
 * Cómo le entra la plata al usuario, en una línea.
 * @param {{ incomeType: string|null, payDays: number[] }} profile
 * @returns {string}
 */
export function incomeSummary({ incomeType, payDays }) {
  if (incomeType === 'sin_fecha') return 'Sin fecha fija';
  if (incomeType !== 'fecha_fija') return 'Aún no nos has dicho';
  const days = payDays.join(', ').replace(/, (\d+)$/, ' y $1');
  return `Con fecha fija, ${payDays.length === 1 ? 'el día' : 'los días'} ${days}`;
}

/**
 * Revisa un compromiso escrito en un formulario.
 * @param {{ name: string, amount: string, dayOfMonth: string }} form
 * @returns {{ data?: { name: string, amount: number, dayOfMonth: number }, error?: string }}
 */
export function readCommitmentForm({ name, amount, dayOfMonth }) {
  const cleanName = name.trim();
  const cleanAmount = Number(amount);
  const day = Number(dayOfMonth);
  if (!cleanName) return { error: 'Escribe el nombre del pago.' };
  if (!(cleanAmount > 0)) return { error: `Escribe cuánto pagas por ${cleanName}.` };
  if (!Number.isInteger(day) || day < 1 || day > 31) return { error: `Escribe un día entre 1 y 31 para ${cleanName}.` };
  return { data: { name: cleanName, amount: cleanAmount, dayOfMonth: day } };
}
