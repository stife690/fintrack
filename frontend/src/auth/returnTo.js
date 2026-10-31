/**
 * A dónde volver después de iniciar sesión (p. ej. el enlace de invitación a una vaca).
 *
 * `ProtectedRoute` la guarda en `localStorage` cuando alguien sin sesión abre una página privada.
 * El estado de navegación (`state.from`) se pierde al recargar, al ir y volver del registro o al
 * abrir el enlace de un correo en otra pestaña; guardada en el dispositivo sobrevive a todo eso.
 * Vence en una hora para no mandar a nadie a una invitación vieja.
 */
const KEY = 'fintrack:returnTo';
const TTL_MS = 60 * 60 * 1000;

/**
 * Solo rutas internas de la zona privada: nunca otra web (evita redirecciones abiertas).
 * @param {unknown} path
 * @returns {boolean}
 */
function isSafe(path) {
  return typeof path === 'string' && /^\/app(\/|$|\?)/.test(path);
}

/**
 * Guarda la ruta privada que se quería abrir.
 * @param {string} path Ruta con su `?query`, p. ej. `/app/vacas/unirse/4NS6NP`.
 * @returns {void}
 */
export function saveReturnTo(path) {
  if (!isSafe(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Sin almacenamiento (modo privado estricto): queda `state.from`.
  }
}

/**
 * Ruta a la que se vuelve tras entrar: la guardada (si no venció), si no `from`, si no `/app`.
 * No la borra: la borra `clearReturnTo` al llegar, así un doble render no la pierde.
 * @param {string} [from] `location.state.from`.
 * @param {number} [now]
 * @returns {string}
 */
export function getReturnTo(from, now = Date.now()) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && isSafe(saved.path) && now - saved.at < TTL_MS) return saved.path;
  } catch {
    // Valor dañado o sin almacenamiento: se usa `from`.
  }
  return isSafe(from) ? from : '/app';
}

/**
 * Olvida la ruta guardada (ya se llegó a ella).
 * @returns {void}
 */
export function clearReturnTo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nada que borrar.
  }
}

/**
 * Si se llegó a la ruta guardada, la olvida.
 * @param {string} path Ruta actual con su `?query`.
 * @returns {void}
 */
export function clearReturnToIfReached(path) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved?.path === path) clearReturnTo();
  } catch {
    clearReturnTo();
  }
}

/**
 * @param {string} path
 * @returns {boolean} `true` si la ruta es el enlace de invitación a una vaca.
 */
export function isInvitation(path) {
  return path.startsWith('/app/vacas/unirse/');
}
