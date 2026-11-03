import { listMovements } from '../repositories/analytics.repository.js';
import * as repo from '../repositories/money-profile.repository.js';
import {
  FIXED_CATEGORIES,
  SAVINGS_CATEGORY,
  daysInMonth,
  largeExpenseLimit,
  normalizeDescription,
  shiftMonth,
} from './analytics.service.js';
import { addDays, todayIso } from './insights.service.js';

/**
 * Mi plata (FT-0037): cuánto puede gastar quien cobra con fecha fija y cuánto necesita ganar quien
 * no. Todo se calcula aquí con fórmulas fijas; la plata que aún no entra nunca se cuenta.
 */

/** Días de movimientos recientes que se usan para medir el ritmo. */
export const PACE_WINDOW_DAYS = 30;

/** Con menos días de historial no se habla de ritmo: un par de gastos no dicen nada. */
export const MIN_PACE_DAYS = 14;

/** Desde este porcentaje del límite del día se avisa que ya casi llega. */
export const DAY_NEAR_LIMIT = 0.8;

/** Margen sobre el gasto normal antes de decir que sobra plata. */
const SAVE_CUSHION = 1.2;

/** Parte de lo que sobra que se sugiere apartar. */
const SAVE_SHARE = 0.5;

/** Lo mínimo que debe sobrar para dar el consejo. */
const SAVE_MIN_SURPLUS = 100000;

/** Sin historial no se sabe cuánto gasta: solo se aconseja desde esta plata libre. */
const SAVE_MIN_FREE = 500000;

/** Parte de la plata libre que se considera sobrante sin historial. */
const SAVE_SHARE_NO_PACE = 0.4;

/** El consejo se redondea hacia abajo a este múltiplo. */
const SAVE_ROUNDING = 10000;

/** Días que se miran hacia adelante cuando no hay fecha de pago. */
const SAVE_DEFAULT_DAYS = 30;

/** La meta diaria se redondea hacia arriba a este múltiplo, para que no se quede corta. */
const GOAL_ROUNDING = 100;

const sum = (movements) => movements.reduce((acc, m) => acc + m.amount, 0);

/** @returns {number} Días de `from` a `to` (AAAA-MM-DD). */
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Fecha de un día del mes. Un 31 cae el último día en los meses más cortos.
 * @param {string} month AAAA-MM
 * @param {number} day
 * @returns {string} AAAA-MM-DD
 */
export function dateInMonth(month, day) {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`;
}

/**
 * Próximo pago después de hoy. Si hoy es día de pago, cuenta el siguiente: lo de hoy ya se suma
 * cuando el usuario lo registra.
 * @param {number[]} payDays
 * @param {string} today AAAA-MM-DD
 * @returns {string} AAAA-MM-DD
 */
export function nextPayDate(payDays, today) {
  const month = today.slice(0, 7);
  return [month, shiftMonth(month, 1), shiftMonth(month, 2)]
    .flatMap((m) => payDays.map((day) => dateInMonth(m, day)))
    .filter((date) => date > today)
    .sort()[0];
}

/**
 * @param {{ name: string }} commitment
 * @param {{ description: string }} expense
 * @returns {boolean} `true` si el gasto lleva el nombre del compromiso.
 */
export function isPaymentOf(commitment, expense) {
  return normalizeDescription(expense.description).includes(normalizeDescription(commitment.name));
}

/**
 * Compromisos que faltan por pagar. Sin `until`, los de este mes que no tienen un gasto con su
 * nombre. Con `until`, los que vencen antes de esa fecha, incluidos los atrasados y los del mes
 * siguiente; lo que vence ese mismo día se paga con esa plata.
 *
 * @param {{ commitments: import('../repositories/money-profile.repository.js').CommitmentRecord[], expenses: import('../repositories/analytics.repository.js').AnalyticsMovement[], today: string, until?: string }} data
 *   `expenses`: gastos del mes actual.
 * @returns {Array<{ id: string, name: string, amount: number, date: string }>} Por fecha.
 */
export function pendingCommitments({ commitments, expenses, today, until }) {
  const month = today.slice(0, 7);
  const pending = [];
  for (const { id, name, amount, dayOfMonth } of commitments) {
    const add = (date) => pending.push({ id, name, amount, date });
    const thisMonth = dateInMonth(month, dayOfMonth);
    if (!expenses.some((e) => isPaymentOf({ name }, e)) && (!until || thisMonth < until)) add(thisMonth);
    const nextMonth = dateInMonth(shiftMonth(month, 1), dayOfMonth);
    if (until && nextMonth < until) add(nextMonth);
  }
  return pending.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Cuánto gasta y gana el usuario en un día normal, según los últimos `PACE_WINDOW_DAYS`. El gasto
 * no cuenta compromisos, gastos fijos, ahorro ni compras grandes: esos no se repiten a diario.
 *
 * @param {{ movements: import('../repositories/analytics.repository.js').AnalyticsMovement[], commitments: Array<{ name: string }>, today: string }} data
 * @returns {{ pace: number|null, usualIncome: number|null }} `null` sin `MIN_PACE_DAYS` de historial.
 */
export function dailyRhythm({ movements, commitments, today }) {
  if (movements.length === 0) return { pace: null, usualIncome: null };
  const first = movements.map((m) => m.date).sort()[0];
  const days = daysBetween(first, today) + 1;
  if (days < MIN_PACE_DAYS) return { pace: null, usualIncome: null };

  const variable = movements.filter(
    (m) =>
      m.type === 'gasto' &&
      !FIXED_CATEGORIES.includes(m.category) &&
      m.category !== SAVINGS_CATEGORY &&
      !commitments.some((c) => isPaymentOf(c, m)),
  );
  const limit = largeExpenseLimit(variable.map((m) => m.amount));
  return {
    pace: sum(variable.filter((m) => m.amount < limit)) / days,
    usualIncome: sum(movements.filter((m) => m.type === 'ingreso')) / days,
  };
}

/**
 * Plata actual: lo que dicen los movimientos, salvo que el usuario haya fijado su saldo o los
 * movimientos no digan nada útil (solo gastos, o ninguno).
 * @param {{ profile: { balance: number|null, balanceCorrected?: boolean }|null, changes: { income: number, expense: number }, totals: { income: number, expense: number } }} data
 * @returns {number|null} `null` si no hay de dónde sacarla.
 */
export function currentMoney({ profile, changes, totals }) {
  const ledger = totals.income - totals.expense;
  if (profile?.balanceCorrected || ledger <= 0) {
    return typeof profile?.balance === 'number' ? profile.balance + changes.income - changes.expense : null;
  }
  return ledger;
}

/**
 * Con fecha fija: `(libre + gastado hoy) ÷ días hasta el pago`. Lo de hoy se devuelve a la cuenta
 * para que el límite quede fijo todo el día; si no, bajaría con cada gasto y nunca se pasaría.
 * @param {{ free: number, spentToday: number, nextPay: string, today: string }} data
 * @returns {object} `mode` `daily` con `perDay`, `spentToday`, `leftToday`, `overBy` y `dayStatus`.
 */
function dailyPlan({ free, spentToday, nextPay, today }) {
  const days = daysBetween(today, nextPay);
  const perDay = Math.floor(Math.max(0, free + spentToday) / days);
  let dayStatus = 'ok';
  if (spentToday > perDay) dayStatus = 'over';
  else if (perDay > 0 && spentToday >= perDay * DAY_NEAR_LIMIT) dayStatus = 'near';
  return {
    mode: 'daily',
    nextPay,
    days,
    perDay,
    spentToday: Math.round(spentToday),
    leftToday: Math.round(Math.max(0, perDay - spentToday)),
    overBy: Math.round(Math.max(0, spentToday - perDay)),
    dayStatus,
  };
}

/**
 * Cuánto se le sugiere apartar a quien le sobra plata: la mitad de lo que le queda después de su
 * gasto normal con un margen. Sin historial, una parte de lo libre.
 * @param {{ free: number, pace: number|null, days: number }} data
 * @returns {number} 0 si no le sobra.
 */
export function saveAdvice({ free, pace, days }) {
  if (pace === null) {
    if (free < SAVE_MIN_FREE) return 0;
    return Math.floor((free * SAVE_SHARE_NO_PACE * SAVE_SHARE) / SAVE_ROUNDING) * SAVE_ROUNDING;
  }
  const surplus = free - pace * days * SAVE_CUSHION;
  if (surplus < SAVE_MIN_SURPLUS) return 0;
  return Math.floor((surplus * SAVE_SHARE) / SAVE_ROUNDING) * SAVE_ROUNDING;
}

/**
 * Sin fecha fija: `(compromisos + gasto normal × días − plata) ÷ días`, hasta el último compromiso
 * pendiente. Si da cero o menos ya cubre todo, y se dice cuántos días le dura lo que le queda.
 *
 * @param {{ money: number, free: number, pending: Array<{ name: string, amount: number, date: string }>, pace: number|null, usualIncome: number|null, todayIncome: number, today: string }} data
 * @returns {object} `mode` `goal` (`goal`, `days`, `until`, `todayIncome`, `usualIncome`) o `runway` (`runwayDays`).
 */
function variablePlan({ money, free, pending, pace, usualIncome, todayIncome, today }) {
  const last = pending.at(-1);
  if (last) {
    const days = Math.max(1, daysBetween(today, last.date));
    const goal = (sum(pending) + (pace ?? 0) * days - money) / days;
    if (goal > 0) {
      return {
        mode: 'goal',
        goal: Math.ceil(goal / GOAL_ROUNDING) * GOAL_ROUNDING,
        days,
        until: last.name,
        todayIncome: Math.round(todayIncome),
        usualIncome: usualIncome === null ? null : Math.round(usualIncome),
      };
    }
  }
  return { mode: 'runway', runwayDays: pace > 0 ? Math.floor(Math.max(0, free) / pace) : null };
}

/**
 * Plan del usuario. Sin saber cómo le entra la plata o cuánta tiene no se calcula nada.
 *
 * @param {object} data
 * @param {{ incomeType: string|null, payDays: number[], balance: number|null }|null} data.profile
 * @param {import('../repositories/money-profile.repository.js').CommitmentRecord[]} data.commitments
 * @param {{ income: number, expense: number }} data.changes Lo registrado desde que dijo su saldo.
 * @param {{ income: number, expense: number }} [data.totals] Todo lo registrado.
 * @param {Array<{ description: string, amount: number, createdAt?: Date }>} [data.todayExpenses] Gastos de hoy.
 * @param {import('../repositories/analytics.repository.js').AnalyticsMovement[]} data.movements Desde hace `PACE_WINDOW_DAYS` y desde el día 1 del mes.
 * @param {string} data.today AAAA-MM-DD
 * @returns {object} Ver `GET /api/v1/money-profile/plan` en `docs/api/openapi.yaml`.
 */
export function buildMoneyPlan({
  profile,
  commitments,
  changes,
  totals = { income: 0, expense: 0 },
  todayExpenses = [],
  movements,
  today,
}) {
  const money = currentMoney({ profile, changes, totals });
  if (!profile?.incomeType || money === null) return { ready: false };

  const month = today.slice(0, 7);
  const firstRecent = addDays(today, 1 - PACE_WINDOW_DAYS);
  const expenses = movements.filter((m) => m.type === 'gasto' && m.date.startsWith(month));
  const recent = movements.filter((m) => m.date >= firstRecent);
  const fixed = profile.incomeType === 'fecha_fija';
  const nextPay = fixed ? nextPayDate(profile.payDays, today) : undefined;

  const pending = pendingCommitments({ commitments, expenses, today, until: nextPay });
  const pendingTotal = sum(pending);
  const free = money - pendingTotal;
  const { pace, usualIncome } = dailyRhythm({ movements: recent, commitments, today });
  const todayIncome = sum(movements.filter((m) => m.type === 'ingreso' && m.date === today));
  // Pagar un compromiso no es gasto del día, y lo gastado antes de fijar el saldo ya estaba en él.
  const spentToday = sum(
    todayExpenses.filter(
      (e) =>
        !commitments.some((c) => isPaymentOf(c, e)) &&
        !(profile.balanceCorrected && e.createdAt && e.createdAt <= profile.balanceAt),
    ),
  );
  const plan = fixed
    ? dailyPlan({ free, spentToday, nextPay, today })
    : variablePlan({ money, free, pending, pace, usualIncome, todayIncome, today });

  return {
    ready: true,
    money: Math.round(money),
    ledger: Math.round(totals.income - totals.expense),
    pendingTotal: Math.round(pendingTotal),
    free: Math.round(free),
    shortfall: Math.round(Math.max(0, -free)),
    pace: pace === null ? null : Math.round(pace),
    hasCommitments: commitments.length > 0,
    pending,
    // Decirle que le sobra a quien hoy va en el límite o ya se pasó sería contradictorio.
    saveAdvice:
      plan.mode === 'goal' || (plan.dayStatus ?? 'ok') !== 'ok'
        ? 0
        : saveAdvice({ free, pace, days: plan.days ?? SAVE_DEFAULT_DAYS }),
    ...plan,
  };
}

/**
 * @param {object} [deps] Dependencias reemplazables en las pruebas.
 * @param {() => Date} [deps.now]
 * @returns {{ getPlan: (userId: string) => Promise<object> }}
 */
export function createMoneyPlanService(deps = {}) {
  const now = deps.now ?? (() => new Date());

  /**
   * Plan de hoy del usuario.
   * @param {string} userId
   * @returns {Promise<object>} Ver `buildMoneyPlan`.
   */
  async function getPlan(userId) {
    const today = todayIso(now());
    const firstRecent = addDays(today, 1 - PACE_WINDOW_DAYS);
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    const [profile, commitments, changes, totals, todayExpenses, movements] = await Promise.all([
      repo.findProfile(userId),
      repo.listCommitments(userId),
      repo.changesSinceBalance(userId),
      repo.movementTotals(userId),
      repo.expensesOfDay(userId, today),
      listMovements(userId, { from: firstRecent < firstOfMonth ? firstRecent : firstOfMonth, to: today }),
    ]);
    return buildMoneyPlan({ profile, commitments, changes, totals, todayExpenses, movements, today });
  }

  return { getPlan };
}

export const { getPlan } = createMoneyPlanService();
