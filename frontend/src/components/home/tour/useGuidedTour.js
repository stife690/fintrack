import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import script from './recorrido.json';
import { scrollAt, segmentAt, segmentForScroll } from './timeline';

export const TOUR_SEGMENTS = script.segments;
export const TOUR_DURATION = script.duration;

const AUDIO_SRC = '/audio/recorrido.mp3';
/** Espacio para la barra de navegación fija al bajar a cada sección. */
const NAV_OFFSET = 72;
/** Teclas con las que la persona se mueve por su cuenta (y que pausan el recorrido). */
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

/** Altura de scroll de cada sección del guion (la primera es siempre el inicio de la página). */
function measureTops() {
  return TOUR_SEGMENTS.map(({ id }, i) => {
    const el = document.getElementById(id);
    if (i === 0 || !el) return 0;
    return Math.max(0, el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET);
  });
}

/**
 * Recorrido con voz: un solo audio con los tiempos de cada frase; mientras suena, la página
 * baja sola a la sección de cada frase. Si la persona hace scroll con la rueda, el dedo o el
 * teclado, se pausa ("baja a tu ritmo"); al seguir, retoma desde la sección que tiene en pantalla.
 * Si el navegador no puede reproducir el audio, el recorrido sigue igual con subtítulos.
 *
 * @returns {{ status: 'idle'|'playing'|'paused'|'done', index: number, progress: number,
 *   muted: boolean, start: () => void, pause: () => void, resume: () => void, stop: () => void }}
 */
export default function useGuidedTour() {
  const reduced = useReducedMotion();
  const [status, setStatus] = useState('idle');
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);

  const audio = useRef(null);
  // Copia local del audio (blob): siempre se puede saltar a cualquier segundo, aunque el
  // servidor no acepte peticiones por rangos (pasa con el servidor de desarrollo).
  const blobUrl = useRef(null);
  // Segundo pedido mientras el audio termina de saltar ahí (si no, leería 0 un instante).
  const pendingFrom = useRef(null);
  const pendingAt = useRef(0);
  const tops = useRef([]);
  // Reloj de respaldo cuando no hay audio: segundo de inicio y momento en que arrancó.
  const silent = useRef(null);
  const raf = useRef(0);

  const now = useCallback(() => {
    if (silent.current) return silent.current.from + (performance.now() - silent.current.at) / 1000;
    const a = audio.current;
    if (!a) return 0;
    if (pendingFrom.current !== null) {
      if (Math.abs(a.currentTime - pendingFrom.current) < 0.5) pendingFrom.current = null;
      else if (performance.now() - pendingAt.current > 2000) {
        // No logró saltar (sin copia local y sin rangos): seguimos solo con subtítulos.
        a.pause();
        silent.current = { from: pendingFrom.current, at: performance.now() };
        pendingFrom.current = null;
        setMuted(true);
        return silent.current.from;
      } else return pendingFrom.current;
    }
    return a.currentTime;
  }, []);

  const stopLoop = () => cancelAnimationFrame(raf.current);

  const loop = useCallback(() => {
    const t = now();
    if (t >= TOUR_DURATION) {
      setStatus('done');
      setProgress(1);
      silent.current = null;
      return;
    }
    window.scrollTo(0, scrollAt(t, TOUR_SEGMENTS, tops.current, reduced ? 0 : 1.1));
    setIndex((prev) => {
      const next = segmentAt(t, TOUR_SEGMENTS);
      return prev === next ? prev : next;
    });
    setProgress(t / TOUR_DURATION);
    raf.current = requestAnimationFrame(loop);
  }, [now, reduced]);

  /** Arranca (o retoma) en el segundo `from`. */
  const playFrom = useCallback(
    (from) => {
      tops.current = measureTops();
      if (!audio.current) {
        // La primera vez suena directo desde la URL (dentro del clic, para que el navegador lo
        // permita) y en paralelo se baja la copia local para los saltos posteriores.
        audio.current = new Audio(AUDIO_SRC);
        audio.current.preload = 'auto';
        fetch(AUDIO_SRC)
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => {
            if (b) blobUrl.current = URL.createObjectURL(b);
          })
          .catch(() => {});
      }
      const a = audio.current;
      silent.current = null;
      if (from > 0 && blobUrl.current && a.src !== blobUrl.current) a.src = blobUrl.current;
      pendingFrom.current = from > 0 ? from : null;
      pendingAt.current = performance.now();
      if (a.readyState >= 1) a.currentTime = from;
      else a.addEventListener('loadedmetadata', () => (a.currentTime = from), { once: true });
      setStatus('playing');
      a.play()
        .then(() => setMuted(false))
        .catch(() => {
          // Sin audio (archivo no disponible o el navegador lo bloqueó): seguimos con subtítulos.
          silent.current = { from, at: performance.now() };
          setMuted(true);
        });
      stopLoop();
      raf.current = requestAnimationFrame(loop);
    },
    [loop],
  );

  const start = useCallback(() => playFrom(0), [playFrom]);

  const pause = useCallback(() => {
    stopLoop();
    if (silent.current) silent.current = { from: now(), at: performance.now(), paused: true };
    audio.current?.pause();
    setStatus((s) => (s === 'playing' ? 'paused' : s));
  }, [now]);

  const resume = useCallback(() => {
    // Retoma desde la sección que la persona tiene en pantalla, no desde donde se pausó.
    const i = segmentForScroll(window.scrollY, measureTops(), window.innerHeight);
    playFrom(TOUR_SEGMENTS[i].start);
  }, [playFrom]);

  const stop = useCallback(() => {
    stopLoop();
    audio.current?.pause();
    silent.current = null;
    setStatus('idle');
    setProgress(0);
    setIndex(0);
  }, []);

  // Si la persona se mueve por su cuenta mientras suena, se pausa.
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const onUser = (e) => {
      if (e.type === 'keydown' && !SCROLL_KEYS.has(e.key)) return;
      pause();
    };
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('touchmove', onUser, { passive: true });
    window.addEventListener('keydown', onUser);
    return () => {
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('touchmove', onUser);
      window.removeEventListener('keydown', onUser);
    };
  }, [status, pause]);

  // Al salir de la página: se detiene el audio y el bucle, y se libera la copia local.
  useEffect(
    () => () => {
      stopLoop();
      audio.current?.pause();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  return { status, index, progress, muted, start, pause, resume, stop };
}
