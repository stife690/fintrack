import { useEffect, useState } from 'react';

/**
 * Alto del teclado del celular sobre la página (0 si está cerrado). En iPhone el teclado tapa los
 * elementos fijos de abajo en vez de empujarlos: con esto la barra se sube justo encima.
 * @returns {number} Píxeles.
 */
export default function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}
