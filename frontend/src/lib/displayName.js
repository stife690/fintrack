/**
 * Nombre corto para saludar al usuario. Usa `user.name` si la API lo envía; si no, lo deduce
 * de la parte del correo antes de la @ (`felipe.roa93@…` → `Felipe`).
 * @param {{ email: string, name?: string|null }|null} user
 * @returns {string}
 */
export function getDisplayName(user) {
  const name = user?.name?.trim();
  if (name) return name.split(/\s+/)[0];

  const local = user?.email?.split('@')[0] ?? '';
  const first = local.split(/[._\-+\d]+/).find(Boolean) ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
}

/**
 * Inicial para el avatar.
 * @param {{ email: string, name?: string|null }|null} user
 * @returns {string}
 */
export function getInitial(user) {
  return (getDisplayName(user) || user?.email || '?').charAt(0).toUpperCase();
}
