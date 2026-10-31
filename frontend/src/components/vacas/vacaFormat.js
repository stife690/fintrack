/**
 * Textos y estilos compartidos de La Vaca Inteligente (FT-0014/FT-0015).
 */
import { formatDate, formatMoney } from '@/components/transactions/format';

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/**
 * @param {number} value
 * @returns {string} p. ej. `62,5 %`.
 */
export function formatPercent(value) {
  return `${percent.format(value)} %`;
}

/** Etiqueta y colores de cada estado de un miembro. */
export const MEMBER_STATUS = {
  cumplido: { label: 'Cumplió', chip: 'bg-positive/15 text-positive', bar: 'bg-positive' },
  al_dia: { label: 'Al día', chip: 'bg-brand-soft text-brand', bar: 'bg-brand' },
  atrasado: { label: 'Atrasado', chip: 'bg-caution/15 text-caution', bar: 'bg-caution' },
  pendiente: { label: 'Le falta', chip: 'bg-ink/10 text-ink/70', bar: 'bg-brand' },
};

/** Etiqueta y colores del estado de la vaca. */
export const VACA_STATUS = {
  activa: { label: 'Activa', chip: 'bg-brand-soft text-brand', bar: 'bg-brand' },
  completada: { label: 'Meta cumplida', chip: 'bg-positive/15 text-positive', bar: 'bg-positive' },
  vencida: { label: 'Venció', chip: 'bg-negative/15 text-negative', bar: 'bg-negative' },
};

/**
 * Dominio público de la app para los enlaces que se comparten (`VITE_APP_URL`, p. ej.
 * `https://fintrackcol.online`). Sin la variable, el dominio en el que se abrió la app.
 * @returns {string} Sin barra final.
 */
export function appOrigin() {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  return (configured || window.location.origin).replace(/\/+$/, '');
}

/**
 * Enlace para invitar a la vaca (lo abre la PWA; si no hay sesión, pasa por el login y vuelve).
 * @param {string} code
 * @param {string} [origin]
 * @returns {string}
 */
export function inviteLink(code, origin = appOrigin()) {
  return `${origin}/app/vacas/unirse/${code}`;
}

/**
 * Hoy en el dispositivo, AAAA-MM-DD (sin pasar por UTC).
 * @param {Date} [now]
 * @returns {string}
 */
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Frase corta sobre el plazo: días que faltan, si ya venció o que no tiene fecha.
 * @param {{ deadline: string|null, projection: import('@/services/vacaService').VacaProjection, status: string }} vaca
 * @returns {string}
 */
export function deadlineText({ deadline, projection, status }) {
  if (!deadline) return 'Sin fecha límite';
  const date = formatDate(deadline);
  if (status === 'completada') return `Fecha límite: ${date}`;
  const days = projection.daysLeft;
  if (days < 0) return `Venció el ${date}`;
  if (days === 0) return `Vence hoy (${date})`;
  return `${days === 1 ? 'Falta 1 día' : `Faltan ${days} días`} · ${date}`;
}

/**
 * Lectura "inteligente" del ritmo: si llegan a tiempo, cuánto hace falta por semana y la fecha
 * estimada. Sale de la proyección que calcula el servidor.
 * @param {{ deadline: string|null, projection: import('@/services/vacaService').VacaProjection, status: string, total: number }} vaca
 * @returns {{ tone: 'positive'|'caution'|'neutral', text: string }}
 */
export function projectionText({ deadline, projection, status, total }) {
  if (status === 'completada') return { tone: 'positive', text: '¡Meta cumplida! Ya juntaron toda la plata.' };
  if (total === 0) return { tone: 'neutral', text: 'Aún no hay aportes. Con el primero calculamos el ritmo del grupo.' };
  const estimated = projection.estimatedDate ? formatDate(projection.estimatedDate) : null;
  if (status === 'vencida') {
    return { tone: 'caution', text: `Pasó la fecha límite y faltan ${formatMoney(projection.remaining)}.` };
  }
  if (!deadline) {
    return {
      tone: 'neutral',
      text: estimated
        ? `A este ritmo (${formatMoney(projection.averagePerDay)} por día) completan la meta hacia el ${estimated}.`
        : 'Sigan aportando para ver cuándo completan la meta.',
    };
  }
  if (projection.onTrack) {
    return {
      tone: 'positive',
      text: `Van a tiempo: a este ritmo completan la meta hacia el ${estimated}.`,
    };
  }
  return {
    tone: 'caution',
    text: `A este ritmo no llegan${estimated ? ` (terminarían hacia el ${estimated})` : ''}. Necesitan ${formatMoney(projection.neededPerWeek ?? projection.remaining)} por semana entre todos.`,
  };
}
