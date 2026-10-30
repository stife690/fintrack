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
 * Frase del ahorro. Con gastos mayores a los ingresos el porcentaje sale negativo y no se entiende
 * ("ahorras el -1.482 %"): se dice cuánto los superan.
 * @param {number|null} rate (ingresos − gastos) ÷ ingresos × 100.
 * @returns {string}
 */
export function savingsDetail(rate) {
  if (rate === null) return 'Aún no hay ingresos este mes';
  if (rate >= 0) return `Ahorras el ${formatNumber(rate)} % de tus ingresos`;
  // gastos ÷ ingresos = 1 − tasa
  const times = 1 - rate / 100;
  if (times >= 2) return `Gastas ${formatNumber(times)} veces lo que ingresas`;
  return `Gastas un ${formatNumber(-rate)} % más de lo que ingresas`;
}

/** Cómo se calcula cada parte del puntaje (la misma regla del backend, `analytics.service.js`). */
export const PART_FORMULAS = {
  savings: '(Ingresos − gastos) ÷ ingresos. Ahorrar el 20 % o más da 25 puntos (regla 50/30/20); 0 % o menos, 0.',
  budgets: 'Presupuestos del mes que no pasan del 100 %. Todos da 25 puntos; sin presupuestos, 12,5.',
  stability:
    'Gasto del mes frente al promedio de tus 3 meses anteriores. Igual o menos da 25 puntos; 30 % más, 0. Sin historial, 12,5.',
  small_expenses: 'Gastos de $ 20.000 o menos, como parte de tu gasto. 5 % o menos da 25 puntos; 20 % o más, 0.',
};

/**
 * La acción que más sube el puntaje: mira la parte con menos puntos (las que dependen del usuario
 * primero) y dice qué hacer, cuántos puntos puede ganar y a dónde ir.
 * @param {import('@/services/analyticsService').Analytics} data
 * @returns {{ title: string, detail: string, gain: number, to?: string, cta?: string }|null}
 *   `null` si todas las partes van bien (20 puntos o más).
 */
export function nextAction({ health, projection, smallExpenses, day, daysInMonth }) {
  const order = ['savings', 'small_expenses', 'budgets', 'stability'];
  const weakest = [...health.parts]
    .filter((p) => p.points < 20 && !(p.key === 'stability' && p.value === null))
    .sort((a, b) => a.points - b.points || order.indexOf(a.key) - order.indexOf(b.key))[0];
  if (!weakest) return null;
  const gain = Math.round(25 - weakest.points);
  const projected = projection.available ? projection.projected : projection.spent;

  switch (weakest.key) {
    case 'savings': {
      // Ingresos muy por debajo del gasto: lo más probable es que falte registrarlos.
      if (projection.expectedIncome < projected * 0.25) {
        return {
          title: 'Registra tus ingresos del mes',
          detail: `Llevas ${formatMoney(projection.expectedIncome)} en ingresos frente a ${formatMoney(projected)} de gasto. Si ya te pagaron, regístralo: el ahorro cuenta con lo que ingresas.`,
          gain,
          to: '/app/transacciones?nuevo=ingreso',
          cta: 'Registrar ingreso',
        };
      }
      if (projection.balance < 0) {
        const perDay = Math.ceil(-projection.balance / (daysInMonth - day + 1));
        return {
          title: 'Baja el ritmo de gasto',
          detail: `Al ritmo actual te faltarían ${formatMoney(-projection.balance)}. Gastar ${formatMoney(perDay)} menos por día te deja en cero.`,
          gain,
        };
      }
      return {
        title: 'Aparta un poco más',
        detail: `Ahorrar el 20 % de tus ingresos (${formatMoney(projection.expectedIncome * 0.2)}) te da los 25 puntos.`,
        gain,
      };
    }
    case 'small_expenses':
      return {
        title: 'Recorta los gastos hormiga',
        detail: `Si bajas a la mitad tus gastos de ${formatMoney(smallExpenses.threshold)} o menos, ahorras ${formatMoney(Math.round(smallExpenses.total / 2))} este mes.`,
        gain,
      };
    case 'budgets':
      return weakest.value === null
        ? {
            title: 'Crea tu primer presupuesto',
            detail: 'Ponle un límite a tu mayor gasto: FinTrack te avisa al llegar al 80 % y al pasarte.',
            gain,
            to: '/app/presupuestos',
            cta: 'Crear presupuesto',
          }
        : {
            title: 'Revisa tus presupuestos',
            detail: 'Algunos ya se pasaron del límite. Ajusta el monto o frena esos gastos lo que queda del mes.',
            gain,
            to: '/app/presupuestos',
            cta: 'Ver presupuestos',
          };
    default:
      return {
        title: 'Vuelve a tu ritmo normal',
        detail: `Este mes gastas un ${formatNumber(weakest.value)} % más que tu promedio.`,
        gain,
      };
  }
}

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
        detail: savingsDetail(value),
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

/**
 * Puntos del gráfico de ritmo de gasto: un punto por día del mes con lo gastado acumulado
 * (`real`, hasta hoy) y la proyección (`projection`, de hoy a fin de mes en línea recta hasta el
 * gasto proyectado). Hoy lleva los dos valores para que las líneas se unan.
 * @param {import('@/services/analyticsService').Analytics} data
 * @returns {Array<{ day: number, real?: number, projection?: number }>}
 */
export function paceSeries({ daily, day, daysInMonth, projection }) {
  const today = daily.at(-1)?.total ?? 0;
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const point = { day: d };
    if (d <= day) point.real = daily[i]?.total ?? today;
    if (projection.available && d >= day) {
      const progress = daysInMonth === day ? 1 : (d - day) / (daysInMonth - day);
      point.projection = Math.round(today + (projection.projected - today) * progress);
    }
    return point;
  });
}

/**
 * Cuánto se puede gastar por día lo que queda del mes sin pasar de los ingresos (hoy incluido).
 * @param {{ projection: { expectedIncome: number, spent: number }, day: number, daysInMonth: number }} data
 * @returns {number} 0 si ya no queda.
 */
export function dailyAllowance({ projection, day, daysInMonth }) {
  const left = projection.expectedIncome - projection.spent;
  return Math.max(0, Math.floor(left / (daysInMonth - day + 1)));
}

/**
 * Cambio del puntaje frente al mes pasado.
 * @param {number} score
 * @param {number|null} previousScore
 * @param {string} month AAAA-MM del mes actual.
 * @returns {{ text: string, direction: 'up'|'down'|'same' }|null} `null` sin mes pasado para comparar.
 */
export function scoreChange(score, previousScore, month) {
  if (previousScore === null || previousScore === undefined) return null;
  const [year, m] = month.split('-').map(Number);
  const previousName = new Date(year, m - 2, 1).toLocaleDateString('es-CO', { month: 'long' });
  const diff = score - previousScore;
  if (diff === 0) return { text: `Igual que en ${previousName}`, direction: 'same' };
  const points = Math.abs(diff) === 1 ? 'punto' : 'puntos';
  return {
    text: `${diff > 0 ? 'Subió' : 'Bajó'} ${Math.abs(diff)} ${points} frente a ${previousName}`,
    direction: diff > 0 ? 'up' : 'down',
  };
}
