/**
 * `30 de noviembre` a partir de `2026-11-30`.
 * @param {string} date AAAA-MM-DD
 * @returns {string}
 */
export function dayAndMonth(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

/** `1 día` o `3 días`. */
const daysText = (days) => (days === 1 ? '1 día' : `${days} días`);

/**
 * Aviso del día, si se acerca o se pasa del límite.
 * @param {{ dayStatus: string, overBy: number, leftToday: number }} plan
 * @param {(value: number) => string} money Formatea un monto (o lo oculta).
 * @returns {string} Vacío si va bien.
 */
export function dayMessage({ dayStatus, overBy, leftToday }, money) {
  if (dayStatus === 'over') return `Te pasaste ${money(overBy)} hoy`;
  if (dayStatus === 'near') return `Ya casi llegas: te quedan ${money(leftToday)}`;
  return '';
}

/**
 * Lo primero que dice la tarjeta de Mi plata, según cómo le entra la plata al usuario.
 * @param {object} plan Respuesta de `GET /money-profile/plan` con `ready: true`.
 * @param {(value: number) => string} money Formatea un monto (o lo oculta).
 * @returns {{ label: string, value: string, note: string, warning?: boolean }}
 */
export function planHeadline(plan, money) {
  if (plan.mode === 'daily') {
    if (plan.shortfall > 0) {
      return {
        label: 'Te faltan',
        value: money(plan.shortfall),
        note: `Para tus pagos antes del ${dayAndMonth(plan.nextPay)}`,
        warning: true,
      };
    }
    return {
      label: 'Puedes gastar hoy',
      value: money(plan.leftToday),
      note: `Faltan ${daysText(plan.days)} para tu pago`,
    };
  }
  if (plan.mode === 'goal') {
    return {
      label: 'Para cubrir todo necesitas hacer',
      value: `${money(plan.goal)} al día`,
      note: `Hasta ${plan.until}, en ${daysText(plan.days)}`,
    };
  }
  if (plan.shortfall > 0) {
    return {
      label: 'Te faltan',
      value: money(plan.shortfall),
      note: 'Revisa tus movimientos o corrige tu saldo',
      warning: true,
    };
  }
  if (plan.runwayDays === null) {
    return {
      label: 'Tienes libres',
      value: money(plan.free),
      note: 'Con 14 días de movimientos te diremos para cuánto te alcanza',
    };
  }
  return {
    label: 'Tu plata te alcanza para',
    value: daysText(plan.runwayDays),
    note: `A tu ritmo de ${money(plan.pace)} al día`,
  };
}
