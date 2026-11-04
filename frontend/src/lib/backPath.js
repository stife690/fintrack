/** Pantallas que se abren desde otra que no es el inicio. Las demás vuelven a `/app`. */
const PARENTS = {
  '/app/calendario': '/app/mi-plata',
  '/app/renta': '/app/insights',
  '/app/transacciones/exportar': '/app/cuenta',
  '/app/invitar': '/app/cuenta',
  '/app/planes': '/app/cuenta',
  '/app/lo-que-viene': '/app/cuenta',
  '/app/lo-que-viene/admin': '/app/lo-que-viene',
};

/** Secciones con pantallas de detalle (`/app/tarjetas/12`, `/app/vacas/unirse/ABC`). */
const WITH_DETAIL = ['/app/tarjetas', '/app/vacas', '/app/negocios'];

/**
 * ¿Hay una pantalla anterior dentro de la app? El enrutador guarda la posición en el historial; un
 * `replace` la conserva, así que subir de pantalla sin historial no deja "Volver" sin efecto.
 * @param {{ idx?: number }|null} historyState `window.history.state`
 * @returns {boolean}
 */
export function canGoBack(historyState) {
  return (historyState?.idx ?? 0) > 0;
}

/**
 * A dónde lleva "Volver" cuando no hay historial, p. ej. al abrir un enlace directo o un aviso.
 * @param {string} pathname
 * @returns {string|null} `null` en el inicio: no hay a dónde volver.
 */
export function backPath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/app') return null;
  if (PARENTS[path]) return PARENTS[path];
  return WITH_DETAIL.find((section) => path.startsWith(`${section}/`)) ?? '/app';
}
