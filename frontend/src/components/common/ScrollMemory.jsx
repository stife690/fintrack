import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const RESTORE_FOR_MS = 1500;
/** Un cambio de página que llega hasta este tiempo después de un clic en `#ancla` es ese clic. */
const ANCHOR_CLICK_MS = 1000;
const positions = new Map();
/** Llave que React Router da a las entradas del historial que no creó él (`#ancla`, primera carga). */
const ANONYMOUS_KEY = 'default';

/**
 * Bajo qué nombre se guarda la posición de una entrada del historial. Las que no creó React Router
 * comparten la llave "default", así que esas se distinguen por su ruta (`/#seguridad`).
 */
export const memoryKey = (key, page) => (key === ANONYMOUS_KEY ? `ruta:${page}` : key);

/**
 * A dónde llevar el scroll al cambiar de página, o `null` para dejar que el navegador decida.
 * Un clic en un enlace `#ancla` llega como POP, igual que "atrás"; en ese caso manda el navegador,
 * que ya está bajando suave hasta la sección.
 * @param {{ hash: string, type: 'POP' | 'PUSH' | 'REPLACE', saved?: number, anchorClick?: boolean }} change
 */
export function scrollTargetFor({ hash, type, saved, anchorClick = false }) {
  if (hash && (type !== 'POP' || anchorClick)) return null;
  if (type === 'POP') return saved ?? (hash ? null : 0);
  return 0;
}

/**
 * Al avanzar a otra página empieza arriba (salvo con un #ancla); al volver, regresa a donde estaba.
 * Los datos llegan después de abrir la página, así que insiste hasta que haya espacio para bajar.
 */
export default function ScrollMemory() {
  const { key, pathname, hash } = useLocation();
  const type = useNavigationType();
  const current = useRef(null);
  const previousPage = useRef(null);
  const anchorClickAt = useRef(-Infinity);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const save = () => {
      if (current.current) positions.set(current.current, window.scrollY);
    };
    const noteAnchorClick = (event) => {
      if (event.target.closest?.('a[href^="#"]')) anchorClickAt.current = performance.now();
    };
    document.addEventListener('click', noteAnchorClick, true);
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      window.removeEventListener('scroll', save);
      document.removeEventListener('click', noteAnchorClick, true);
    };
  }, []);

  useLayoutEffect(() => {
    const page = pathname + hash;
    current.current = memoryKey(key, page);
    const samePage = page === previousPage.current;
    previousPage.current = page;
    if (samePage) return undefined;

    const anchorClick = performance.now() - anchorClickAt.current < ANCHOR_CLICK_MS;
    const target = scrollTargetFor({ hash, type, saved: positions.get(current.current), anchorClick });
    if (target === null) return undefined;
    window.scrollTo({ top: target, behavior: 'instant' });
    if (target === 0) return undefined;

    const started = performance.now();
    let frame = requestAnimationFrame(function keepTrying() {
      window.scrollTo({ top: target, behavior: 'instant' });
      const arrived = Math.abs(window.scrollY - target) < 2;
      if (!arrived && performance.now() - started < RESTORE_FOR_MS) frame = requestAnimationFrame(keepTrying);
    });
    const stop = () => cancelAnimationFrame(frame);
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    window.addEventListener('wheel', stop, { passive: true, once: true });
    return () => {
      stop();
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('wheel', stop);
    };
  }, [key, pathname, hash, type]);

  return null;
}
