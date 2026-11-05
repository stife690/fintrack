// Cálculos del panel de un negocio (FT-0017) y del reparto de utilidades (FT-0018). Son funciones puras: reciben los movimientos ya
// leídos de la base y no tocan nada más, así se prueban sin base de datos.

/** Tipos de movimiento del negocio (`kind` en la API → `tipo` en la base). */
export const KIND_TO_DB = {
  sale: 'venta',
  otherIncome: 'otro_ingreso',
  cost: 'costo_venta',
  fixed: 'gasto_fijo',
  variable: 'gasto_variable',
  withdrawal: 'retiro',
};
/** Lo que se registra con `POST /movements`; los retiros van por su propia ruta. */
export const KINDS = ['sale', 'otherIncome', 'cost', 'fixed', 'variable'];
/** Categoría con la que se guardan los retiros. */
export const WITHDRAWAL_CATEGORY = 'retiros';
/** Los que entran plata; el resto la sacan. */
export const INCOME_KINDS = ['sale', 'otherIncome'];

/** Categorías del negocio, iguales para todos (las propias quedan para después). */
export const CATEGORIES = [
  'ventas',
  'insumos',
  'arriendo',
  'nomina',
  'servicios',
  'publicidad',
  'transporte',
  'impuestos',
  'otros',
];
/** Categoría que se usa si no se elige una. */
export const DEFAULT_CATEGORY = {
  sale: 'ventas',
  otherIncome: 'otros',
  cost: 'insumos',
  fixed: 'arriendo',
  variable: 'otros',
};

const round2 = (n) => Math.round(n * 100) / 100;
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Primer y último día de un mes.
 * @param {string} month AAAA-MM.
 * @returns {{ from: string, to: string }}
 */
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * @param {string} month AAAA-MM.
 * @returns {string} El mes anterior, AAAA-MM.
 */
export function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Suma los montos por tipo.
 * @param {Array<{ kind: string, amount: number }>} movements
 * @returns {{ sale: number, otherIncome: number, cost: number, fixed: number, variable: number, withdrawal: number }}
 */
export function sumByKind(movements) {
  const totals = { sale: 0, otherIncome: 0, cost: 0, fixed: 0, variable: 0, withdrawal: 0 };
  for (const m of movements) totals[m.kind] += m.amount;
  for (const k of Object.keys(totals)) totals[k] = round2(totals[k]);
  return totals;
}

/**
 * Cambio porcentual entre dos valores, o `null` si antes era 0 (no hay con qué comparar).
 * @param {number} now
 * @param {number} before
 * @returns {number|null}
 */
export function percentChange(now, before) {
  if (before === 0) return null;
  return round1(((now - before) / Math.abs(before)) * 100);
}

/**
 * Indicadores del mes a partir de las sumas por tipo.
 * - Utilidad bruta = ventas − costo de venta.
 * - Utilidad neta = todo lo que entró − todo lo que salió.
 * - Margen neto = utilidad neta / ventas.
 * - Margen de contribución = (ventas − costo de venta − gastos variables) / ventas: lo que deja cada
 *   peso vendido para pagar los gastos fijos.
 * - Punto de equilibrio = gastos fijos / margen de contribución: cuánto hay que vender en el mes
 *   para no perder. Es `null` si no hay gastos fijos o si vender no deja nada.
 * - Los retiros de los socios no son gasto: no bajan la utilidad. `retained` es lo que queda en el
 *   negocio después de ellos.
 * @param {ReturnType<typeof sumByKind>} t
 * @returns {object}
 */
export function indicators(t) {
  const income = round2(t.sale + t.otherIncome);
  const expenses = round2(t.cost + t.fixed + t.variable);
  const grossProfit = round2(t.sale - t.cost);
  const netProfit = round2(income - expenses);
  const contribution = t.sale > 0 ? (t.sale - t.cost - t.variable) / t.sale : null;
  // Se redondea hacia arriba a pesos enteros: es lo mínimo que hay que vender.
  const breakEven =
    t.fixed > 0 && contribution > 0 ? Math.ceil(t.fixed / contribution - 1e-9) : null;
  return {
    ...t,
    income,
    expenses,
    grossProfit,
    netProfit,
    netMargin: t.sale > 0 ? round1((netProfit / t.sale) * 100) : null,
    contributionMargin: contribution === null ? null : round1(contribution * 100),
    breakEven,
    breakEvenReached: breakEven === null ? null : t.sale >= breakEven,
    retained: round2(netProfit - t.withdrawal),
  };
}

/**
 * Entradas y salidas por semana del mes (días 1–7, 8–14, 15–21, 22–28 y 29 al final).
 * @param {Array<{ kind: string, amount: number, date: string }>} movements Del mes.
 * @param {string} month AAAA-MM.
 * @returns {Array<{ label: string, from: string, to: string, in: number, out: number, net: number }>}
 */
export function weeklyCashFlow(movements, month) {
  const { to: last } = monthRange(month);
  const lastDay = Number(last.slice(8));
  const weeks = [];
  for (let start = 1; start <= lastDay; start += 7) {
    const end = Math.min(start + 6, lastDay);
    weeks.push({
      label: `${start}–${end}`,
      from: `${month}-${String(start).padStart(2, '0')}`,
      to: `${month}-${String(end).padStart(2, '0')}`,
      in: 0,
      out: 0,
    });
  }
  for (const m of movements) {
    const week = weeks[Math.floor((Number(m.date.slice(8)) - 1) / 7)];
    if (!week) continue;
    if (INCOME_KINDS.includes(m.kind)) week.in += m.amount;
    else week.out += m.amount;
  }
  return weeks.map((w) => ({
    ...w,
    in: round2(w.in),
    out: round2(w.out),
    net: round2(w.in - w.out),
  }));
}

/**
 * Propuesta de reparto de la utilidad del mes según la participación de cada socio. Lo que ya
 * retiró cada uno en el mes se descuenta de lo que le toca. Si no hubo utilidad no se reparte nada.
 * @param {{ netProfit: number, partners: Array<{ userId: string, name: string|null, share: number|null }>, withdrawals: Array<{ userId: string|null, amount: number }> }} input
 * @returns {{ available: number, unassignedShare: number, items: Array<{ userId: string, name: string|null, share: number, due: number, withdrawn: number, pending: number }> }}
 */
export function distribution({ netProfit, partners, withdrawals }) {
  const available = Math.max(0, round2(netProfit));
  const withdrawn = new Map();
  for (const w of withdrawals) {
    if (w.userId) withdrawn.set(w.userId, (withdrawn.get(w.userId) ?? 0) + w.amount);
  }
  const items = partners
    .filter((p) => p.share > 0)
    .map((p) => {
      const due = Math.floor((available * p.share) / 100);
      const taken = round2(withdrawn.get(p.userId) ?? 0);
      return {
        userId: p.userId,
        name: p.name,
        share: p.share,
        due,
        withdrawn: taken,
        pending: Math.max(0, round2(due - taken)),
      };
    });
  const assigned = partners.reduce((sum, p) => sum + (p.share > 0 ? p.share : 0), 0);
  return { available, unassignedShare: round2(Math.max(0, 100 - assigned)), items };
}

/**
 * Panel completo del mes.
 * @param {{ month: string, movements: Array<{ kind: string, amount: number, date: string }>, previousMovements: Array<{ kind: string, amount: number }> }} input
 * @returns {object}
 */
export function buildPanel({ month, movements, previousMovements }) {
  const current = indicators(sumByKind(movements));
  const before = indicators(sumByKind(previousMovements));
  return {
    month,
    ...current,
    previous: {
      month: previousMonth(month),
      sale: before.sale,
      netProfit: before.netProfit,
      saleChange: percentChange(current.sale, before.sale),
      netProfitChange: percentChange(current.netProfit, before.netProfit),
    },
    cashFlow: weeklyCashFlow(movements, month),
  };
}
