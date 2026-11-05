/**
 * Medición de fluidez de la escena 3D, sin depender de three.js, para poder probarla.
 *
 * Se descartan los primeros cuadros (calentamiento: el navegador compila los shaders y eso
 * siempre traba un instante) y los saltos largos (pestaña oculta, cambio de app), que no dicen
 * nada del equipo. Con el resto se calculan los cuadros por segundo reales.
 */

/** Cuadros por segundo mínimos para quedarse con el 3D. */
export const MIN_FPS = 40;
/** Segundos que se ignoran al empezar (compilación de shaders). */
export const WARMUP = 0.4;
/** Segundos de muestra que se miden después del calentamiento. */
export const SAMPLE = 1.5;
/** Un cuadro más largo que esto es una pausa (pestaña oculta), no lentitud. */
const MAX_GAP = 0.25;

/**
 * Crea un medidor. Se le pasa la duración de cada cuadro (`delta`, en segundos) y responde:
 * `'measuring'` mientras junta muestra, `'ok'` si va fluido o `'slow'` si no.
 */
export function createFpsMeter({ minFps = MIN_FPS, warmup = WARMUP, sample = SAMPLE } = {}) {
  let warm = 0;
  let time = 0;
  let frames = 0;
  return (delta) => {
    if (delta > MAX_GAP) return 'measuring';
    if (warm < warmup) {
      warm += delta;
      return 'measuring';
    }
    time += delta;
    frames += 1;
    if (time < sample) return 'measuring';
    return frames / time >= minFps ? 'ok' : 'slow';
  };
}
