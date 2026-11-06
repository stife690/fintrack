/** Cuántas categorías van por nombre en la dona; el resto se junta en "Otras". */
const MAX_NAMED = 4;
const HUE_COUNT = 8;

/** Cada categoría conserva su tono de un mes a otro, para reconocerla sin leer. */
const HUES = {
  alimentacion: 1,
  transporte: 2,
  vivienda: 3,
  servicios_publicos: 4,
  salud: 5,
  educacion: 6,
  entretenimiento: 7,
  ropa_accesorios: 8,
};

/** "Otros" y lo que falta por clasificar no dicen nada por sí solos: van en gris, junto con el resto. */
const isGeneric = (key) => key === null || key === 'otros';

const hashHue = (key) => ([...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % HUE_COUNT) + 1;

/** El tono de la categoría o, si ya lo tiene otra en este gráfico, el siguiente libre. */
function pickHue(key, used) {
  let hue = HUES[key] ?? hashHue(key);
  while (used.has(hue)) hue = (hue % HUE_COUNT) + 1;
  used.add(hue);
  return hue;
}

/**
 * Convierte los gastos por categoría en las partes de la dona.
 * @param {Array<{ category: string|null, total: number }>} byCategory
 * @param {Record<string, string>} names Clave → nombre legible.
 * @returns {Array<{ key: string, name: string, total: number, share: number, hue: number|null }>}
 *   De mayor a menor, con "Otras" al final; `share` va de 0 a 100 y `hue` es `null` en lo gris.
 */
export function expenseSlices(byCategory, names) {
  const rows = byCategory.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const sum = rows.reduce((total, r) => total + r.total, 0);
  const specific = rows.filter((r) => !isGeneric(r.category));
  const named = specific.slice(0, MAX_NAMED);
  const rest = rows.filter((r) => !named.includes(r));
  const used = new Set();
  const slices = named.map((r) => ({
    key: r.category,
    name: names[r.category] ?? r.category,
    total: r.total,
    share: (r.total / sum) * 100,
    hue: pickHue(r.category, used),
  }));
  if (rest.length > 0) {
    const total = rest.reduce((all, r) => all + r.total, 0);
    let name = 'Otras';
    if (rest.length === 1) name = rest[0].category ? (names[rest[0].category] ?? rest[0].category) : 'Sin clasificar';
    slices.push({ key: 'otras', name, total, share: (total / sum) * 100, hue: null });
  }
  return slices;
}

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** @param {number} share De 0 a 100. @returns {string} `38 %`, o `<1 %` si no alcanza a 1. */
export const formatShare = (share) => (share > 0 && share < 1 ? '<1 %' : `${percent.format(share)} %`);
