/**
 * Estilos de las tarjetas de crédito dibujadas. Los degradados son originales (no copian el
 * arte de ningún banco ni franquicia); la franquicia se escribe como texto.
 */

/** Niveles válidos por franquicia (igual que el backend). */
export const TIERS = {
  visa: ['clasica', 'gold', 'platinum', 'black'],
  mastercard: ['clasica', 'gold', 'platinum', 'black'],
  amex: ['green', 'blue', 'gold', 'platinum'],
  otra: ['clasica'],
};

export const NETWORK_LABELS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', otra: 'Otra' };
export const TIER_LABELS = {
  clasica: 'Clásica',
  gold: 'Gold',
  platinum: 'Platinum',
  black: 'Black',
  green: 'Green',
  blue: 'Blue',
};

const LIGHT = '#ffffff';
const DARK = '#111827';

// `dominant` es el color de mayor área del degradado: contra él se mide el contraste.
const palette = {
  clasica: { from: '#1e40af', to: '#3b82f6', dominant: '#1e40af', foreground: LIGHT },
  gold: { from: '#b8860b', to: '#f5d76e', dominant: '#e0b94a', foreground: DARK },
  platinum: { from: '#9ca3af', to: '#e5e7eb', dominant: '#cbd0d8', foreground: DARK },
  black: { from: '#0a0a0a', to: '#262626', dominant: '#0a0a0a', foreground: LIGHT },
  green: { from: '#064e3b', to: '#10b981', dominant: '#065f46', foreground: LIGHT },
  blue: { from: '#7dd3fc', to: '#e0f2fe', dominant: '#a5dcf8', foreground: DARK },
  otra: { from: '#374151', to: '#6b7280', dominant: '#374151', foreground: LIGHT },
};

const style = (key, label) => {
  const p = palette[key];
  return {
    label,
    background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
    foreground: p.foreground,
    dominant: p.dominant,
  };
};

export const CARD_STYLES = Object.fromEntries(
  Object.entries(TIERS).map(([network, tiers]) => [
    network,
    Object.fromEntries(
      tiers.map((tier) => [tier, style(network === 'otra' ? 'otra' : tier, cardLabel(network, tier))]),
    ),
  ]),
);

/**
 * Nombre legible de la tarjeta, p. ej. "Amex Blue". "Otra" va sin nivel.
 * @param {string} network
 * @param {string} tier
 * @returns {string}
 */
export function cardLabel(network, tier) {
  const base = NETWORK_LABELS[network] ?? NETWORK_LABELS.otra;
  return network === 'otra' ? base : `${base} ${TIER_LABELS[tier] ?? ''}`.trim();
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contraste WCAG entre dos colores `#rrggbb`.
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
