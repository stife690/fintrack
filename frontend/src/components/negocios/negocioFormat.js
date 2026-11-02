/**
 * Textos compartidos de Emprendimientos (FT-0016).
 */
import { appOrigin } from '@/components/vacas/vacaFormat';

/** Nombre, explicación y colores de cada rol. */
export const ROLES = {
  dueno: { label: 'Dueño', hint: 'Administra el negocio y sus socios', chip: 'bg-brand-soft text-brand' },
  editor: { label: 'Editor', hint: 'Registra ventas y gastos', chip: 'bg-positive/15 text-positive' },
  lector: { label: 'Lector', hint: 'Solo ve las finanzas (p. ej. el contador)', chip: 'bg-ink/10 text-ink/70' },
};

/** Opciones para elegir un rol. */
export const ROLE_OPTIONS = Object.entries(ROLES).map(([value, { label }]) => ({ value, label }));

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * @param {number} value
 * @returns {string} p. ej. `33,33 %`.
 */
export function formatShare(value) {
  return `${percent.format(value)} %`;
}

/**
 * Enlace para invitar al negocio (lo abre la PWA; si no hay sesión, pasa por el login y vuelve).
 * @param {string} code
 * @param {string} [origin]
 * @returns {string}
 */
export function inviteLink(code, origin = appOrigin()) {
  return `${origin}/app/negocios/unirse/${code}`;
}
