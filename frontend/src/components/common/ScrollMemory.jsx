import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const RESTORE_FOR_MS = 1500;
const positions = new Map();

/**
 * Al avanzar a otra página empieza arriba (salvo con un #ancla); al volver, regresa a donde estaba.
 * Los datos llegan después de abrir la página, así que insiste hasta que haya espacio para bajar.
 */
export default function ScrollMemory() {
  const { key, pathname, hash } = useLocation();
  const type = useNavigationType();
  const current = useRef(key);
  const previousPage = useRef(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const save = () => positions.set(current.current, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, []);

  useLayoutEffect(() => {
    current.current = key;
    const page = pathname + hash;
    const samePage = page === previousPage.current;
    previousPage.current = page;
    if (samePage) return undefined;

    const target = type === 'POP' ? (positions.get(key) ?? 0) : 0;
    if (hash && type !== 'POP') return undefined;
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
