/** Llave de la sesión en `localStorage` (la comparten todas las ventanas de la app). */
export const SESSION_KEY = 'fintrack.session';
const KEY = SESSION_KEY;

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function getSession() {
  const text = localStorage.getItem(KEY);
  return text ? JSON.parse(text) : null;
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
