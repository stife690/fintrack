/**
 * El nivel `exceeded_100` (RN-04) incluye gastar exactamente el límite. Para quien lo lee son cosas
 * distintas: al 100 % no se pasó, solo se le acabó el presupuesto.
 * @param {{ level: string, percentage: number }} alert
 * @returns {boolean}
 */
export function isAtLimit({ level, percentage }) {
  return level === 'exceeded_100' && percentage <= 100;
}

/**
 * Nivel con el que se pinta una alerta: justo en el límite es advertencia, no exceso.
 * @param {{ level: string, percentage: number }} alert
 * @returns {string}
 */
export function displayLevel(alert) {
  return isAtLimit(alert) ? 'warning_80' : alert.level;
}
