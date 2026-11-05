/**
 * Cuentas del recorrido con voz, sin DOM, para poder probarlas:
 * en qué frase va el audio, a qué altura debe estar la página y desde qué frase seguir.
 *
 * Cada frase (`segment`) tiene `start` y `end` en segundos y el `id` de la sección a la que
 * baja la página. La bajada empieza un poco antes de la frase (en la pausa entre frases)
 * y dura `glide` segundos, así la voz arranca cuando la sección ya llegó.
 */

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Antelación de la bajada respecto al inicio de la frase, en segundos. */
export const LEAD = 0.35;

/**
 * Índice de la frase que suena en el segundo `time` (la última que ya empezó).
 * @param {number} time
 * @param {{ start: number }[]} segments
 */
export function segmentAt(time, segments) {
  let index = 0;
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].start - LEAD <= time) index = i;
  }
  return index;
}

/**
 * Altura de scroll que corresponde al segundo `time`.
 * @param {number} time
 * @param {{ start: number }[]} segments
 * @param {number[]} tops Altura (scrollY) de cada sección, en el mismo orden que `segments`.
 * @param {number} [glide=1.1] Duración de la bajada entre secciones; 0 = salto (movimiento reducido).
 */
export function scrollAt(time, segments, tops, glide = 1.1) {
  const i = segmentAt(time, segments);
  if (i === 0 || glide <= 0) return tops[i];
  const from = segments[i].start - LEAD;
  const k = easeInOut(clamp01((time - from) / glide));
  return tops[i - 1] + (tops[i] - tops[i - 1]) * k;
}

/**
 * Frase desde la que conviene seguir si la persona bajó por su cuenta: la última sección
 * cuyo inicio ya pasó el 30% superior de la pantalla.
 * @param {number} scrollY
 * @param {number[]} tops
 * @param {number} viewportHeight
 */
export function segmentForScroll(scrollY, tops, viewportHeight) {
  let index = 0;
  for (let i = 0; i < tops.length; i += 1) {
    if (tops[i] <= scrollY + viewportHeight * 0.3) index = i;
  }
  return index;
}

/**
 * Qué hacer si la persona toca un enlace `#ancla` mientras suena el recorrido: si la voz habla
 * de esa sección, seguir desde su frase (un poco antes, para que la página baje antes de la voz);
 * si no (p. ej. `#faq`), `null`: se pausa y el navegador baja normal.
 * @param {string} hash
 * @param {{ id: string, start: number }[]} segments
 * @returns {{ index: number, time: number } | null}
 */
export function jumpFor(hash, segments) {
  const index = segments.findIndex(({ id }) => `#${id}` === hash);
  if (index <= 0) return null;
  return { index, time: Math.max(0, segments[index].start - LEAD) };
}
