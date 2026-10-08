const KEY = 'fintrack.session';

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
