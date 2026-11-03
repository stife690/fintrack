import { listMovements } from '../repositories/analytics.repository.js';
import * as repo from '../repositories/money-profile.repository.js';
import { daysInMonth, shiftMonth } from './analytics.service.js';
import { todayIso } from './insights.service.js';
import { dateInMonth, getPlan, isPaymentOf, pendingCommitments } from './money-plan.service.js';
import { list as listCards } from './cards.service.js';
import { list as listVacas } from './vacas.service.js';

/**
 * Calendario de pagos (FT-0025): los compromisos de Mi plata, los días de pago y lo que falta
 * aportar a cada vaca, con cuánto le queda al usuario después de cada pago. No guarda nada: todo
 * sale de Mi plata (parche 011) y de las vacas.
 */

/** Días de gasto normal que deben quedar después de un pago para no marcarlo en riesgo. */
export const RISK_DAYS = 7;

/**
 * @typedef {object} CalendarEvent
 * @property {string} date AAAA-MM-DD
 * @property {'compromiso'|'vaca'|'ingreso'|'card'} kind Pago propio, aporte a una vaca, día de pago o pago de una tarjeta.
 * @property {string|null} id Compromiso o vaca; `null` en los días de pago.
 * @property {string} name Nombre del compromiso o de la vaca.
 * @property {number|null} amount `null` en los días de pago: Mi plata no sabe cuánto le pagan.
 * @property {'pagado'|'pendiente'|'atrasado'|'sin_registro'|null} status `sin_registro`: mes
 *   pasado sin un gasto con su nombre. `null` en los días de pago.
 * @property {number|null} balanceAfter Plata que le queda después de este pago. `null` si no se
 *   puede saber (ya pasó, ya se pagó o es después del próximo ingreso).
 * @property {'ok'|'riesgo'|'negativo'|null} risk Ver `riskOf`; `null` si no hay `balanceAfter`.
 */

/**
 * Hasta qué fecha (sin incluirla) se proyecta el saldo. Con fecha fija, hasta el próximo pago:
 * después entra plata que no sabemos cuánto es. Sin fecha fija, hasta el fin del mes siguiente,
 * el mismo horizonte de Mi plata.
 * @param {{ fixed: boolean, nextPay?: string, today: string }} data
 * @returns {string} AAAA-MM-DD
 */
function projectionEnd({ fixed, nextPay, today }) {
  return fixed ? nextPay : `${shiftMonth(today.slice(0, 7), 2)}-01`;
}

/**
 * @param {number} balanceAfter
 * @param {number|null} pace Gasto normal de un día; `null` sin historial suficiente.
 * @returns {'ok'|'riesgo'|'negativo'} `riesgo`: no alcanza para `RISK_DAYS` días de gasto normal.
 */
export function riskOf(balanceAfter, pace) {
  if (balanceAfter < 0) return 'negativo';
  if (pace !== null && balanceAfter < pace * RISK_DAYS) return 'riesgo';
  return 'ok';
}

/**
 * Arma el calendario de un mes. Función pura: recibe los datos ya leídos.
 *
 * El saldo parte de la plata de hoy (la de Mi plata) y resta, en orden de fecha, cada pago que
 * falta: compromisos sin pagar y lo que le falta aportar a cada vaca. Lo atrasado se resta hoy.
 *
 * @param {object} data
 * @param {string} data.month AAAA-MM que se muestra.
 * @param {string} data.today AAAA-MM-DD
 * @param {{ incomeType: string|null, payDays: number[] }|null} data.profile
 * @param {import('../repositories/money-profile.repository.js').CommitmentRecord[]} data.commitments
 * @param {Array<{ description: string }>} data.currentExpenses Gastos (no ingresos) del mes actual.
 * @param {Array<{ description: string }>} data.monthExpenses Gastos (no ingresos) del mes que se muestra.
 * @param {Array<{ id: string, name: string, deadline: string|null, myRemaining: number }>} data.vacas
 * @param {Array<{ id: string, name: string, nextPaymentDate: string, amount: number, paidThisCycle: boolean }>} [data.cards] Tarjetas con su próximo pago.
 * @param {{ ready: boolean, money?: number, pace?: number|null, nextPay?: string }} data.plan Lo de `getPlan`.
 * @returns {{ month: string, today: string, money: number|null, projectedUntil: string|null, events: CalendarEvent[], totals: { pending: number, paid: number } }}
 */
export function buildPaymentCalendar({
  month,
  today,
  profile,
  commitments,
  currentExpenses,
  monthExpenses,
  vacas,
  cards = [],
  plan,
}) {
  const currentMonth = today.slice(0, 7);
  const fixed = profile?.incomeType === 'fecha_fija';
  const end = projectionEnd({ fixed, nextPay: plan.nextPay, today });
  const isPaid = (name, expenses) => expenses.some((e) => isPaymentOf({ name }, e));

  // 1. Lo que falta pagar desde hoy hasta el fin de la proyección, en orden.
  const owed = [
    ...pendingCommitments({ commitments, expenses: currentExpenses, today, until: end }).map(
      (c) => ({ key: `compromiso:${c.id}:${c.date}`, date: c.date, amount: c.amount }),
    ),
    ...vacas
      .filter((v) => v.deadline && v.myRemaining > 0 && v.deadline < end)
      .map((v) => ({ key: `vaca:${v.id}`, date: v.deadline, amount: v.myRemaining })),
    // Pagar la tarjeta baja la plata en mano.
    ...cards
      .filter((c) => !c.paidThisCycle && c.amount > 0 && c.nextPaymentDate < end)
      .map((c) => ({ key: `card:${c.id}`, date: c.nextPaymentDate, amount: c.amount })),
  ]
    // Lo atrasado se paga hoy, antes que lo demás.
    .map((p) => ({ ...p, when: p.date < today ? today : p.date }))
    .sort((a, b) => a.when.localeCompare(b.when));

  // 2. Cuánto queda después de cada uno.
  const balances = new Map();
  if (plan.ready) {
    let balance = plan.money;
    for (const p of owed) {
      balance -= p.amount;
      balances.set(p.key, balance);
    }
  }
  const projected = (key) => {
    if (!balances.has(key)) return { balanceAfter: null, risk: null };
    const balanceAfter = Math.round(balances.get(key));
    return { balanceAfter, risk: riskOf(balanceAfter, plan.pace ?? null) };
  };

  // 3. Los eventos del mes que se muestra.
  const events = [];
  for (const c of commitments) {
    const date = dateInMonth(month, c.dayOfMonth);
    let status;
    if (month < currentMonth) status = isPaid(c.name, monthExpenses) ? 'pagado' : 'sin_registro';
    else if (month === currentMonth && isPaid(c.name, currentExpenses)) status = 'pagado';
    else status = date < today ? 'atrasado' : 'pendiente';
    events.push({
      date,
      kind: 'compromiso',
      id: c.id,
      name: c.name,
      amount: c.amount,
      status,
      ...projected(`compromiso:${c.id}:${date}`),
    });
  }
  for (const v of vacas) {
    if (!v.deadline?.startsWith(month)) continue;
    events.push({
      date: v.deadline,
      kind: 'vaca',
      id: v.id,
      name: v.name,
      amount: v.myRemaining,
      status: v.myRemaining > 0 ? (v.deadline < today ? 'atrasado' : 'pendiente') : 'pagado',
      ...projected(`vaca:${v.id}`),
    });
  }
  for (const c of cards) {
    if (!c.nextPaymentDate?.startsWith(month)) continue;
    events.push({
      date: c.nextPaymentDate,
      kind: 'card',
      id: c.id,
      name: c.name,
      amount: c.amount,
      status: c.paidThisCycle ? 'pagado' : c.nextPaymentDate < today ? 'atrasado' : 'pendiente',
      ...projected(`card:${c.id}`),
    });
  }
  if (fixed) {
    for (const day of new Set(profile.payDays.map((d) => Math.min(d, daysInMonth(month))))) {
      events.push({
        date: dateInMonth(month, day),
        kind: 'ingreso',
        id: null,
        name: 'Día de pago',
        amount: null,
        status: null,
        balanceAfter: null,
        risk: null,
      });
    }
  }
  // Mismo día: primero el ingreso, luego los pagos.
  const order = { ingreso: 0, compromiso: 1, vaca: 2, card: 3 };
  events.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);

  const owes = (e) => e.status === 'pendiente' || e.status === 'atrasado';
  return {
    month,
    today,
    money: plan.ready ? plan.money : null,
    projectedUntil: plan.ready ? end : null,
    events,
    totals: {
      pending: Math.round(events.filter(owes).reduce((acc, e) => acc + e.amount, 0)),
      paid: Math.round(
        events.filter((e) => e.status === 'pagado').reduce((acc, e) => acc + e.amount, 0),
      ),
    },
  };
}

/**
 * @param {object} [deps] Dependencias reemplazables en las pruebas.
 * @param {() => Date} [deps.now]
 * @returns {{ getCalendar: (userId: string, month?: string) => Promise<object> }}
 */
export function createPaymentCalendarService(deps = {}) {
  const now = deps.now ?? (() => new Date());

  /**
   * Calendario de un mes del usuario.
   * @param {string} userId
   * @param {string} [month] AAAA-MM; por defecto el actual.
   * @returns {Promise<object>} Ver `buildPaymentCalendar`.
   */
  async function getCalendar(userId, month) {
    const today = todayIso(now());
    const currentMonth = today.slice(0, 7);
    const shown = month ?? currentMonth;
    // Solo gastos: un ingreso con el nombre de un compromiso no lo paga.
    const expensesOf = async (m) =>
      (
        await listMovements(userId, {
          from: `${m}-01`,
          to: `${m}-${String(daysInMonth(m)).padStart(2, '0')}`,
        })
      ).filter((mv) => mv.type === 'gasto');
    const [profile, commitments, currentExpenses, monthExpenses, vacas, cardList, plan] = await Promise.all([
      repo.findProfile(userId),
      repo.listCommitments(userId),
      expensesOf(currentMonth),
      shown === currentMonth ? null : expensesOf(shown),
      listVacas(userId),
      listCards(userId),
      getPlan(userId),
    ]);
    return buildPaymentCalendar({
      month: shown,
      today,
      profile,
      commitments,
      currentExpenses,
      monthExpenses: monthExpenses ?? currentExpenses,
      vacas,
      cards: cardList.map((c) => ({
        id: c.id,
        name: c.name,
        nextPaymentDate: c.nextPaymentDate,
        amount: c.statementTotal ?? c.used,
        paidThisCycle: c.paidThisCycle,
      })),
      plan,
    });
  }

  return { getCalendar };
}

export const { getCalendar } = createPaymentCalendarService();
