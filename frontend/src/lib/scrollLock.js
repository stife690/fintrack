let locks = 0;
let previous = '';

/**
 * Evita que la página se desplace detrás de una ventana. Se cuentan los bloqueos porque dos
 * ventanas pueden coincidir (una termina de cerrarse mientras otra se abre): la página se libera
 * cuando se cierra la última, sin importar el orden.
 * @returns {() => void} Libera este bloqueo.
 */
export function lockScroll() {
  if (locks === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  locks += 1;
  return () => {
    locks -= 1;
    if (locks === 0) document.body.style.overflow = previous;
  };
}
