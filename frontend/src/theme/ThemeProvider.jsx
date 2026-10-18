import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

/** Preferencias posibles: claro, oscuro o la del sistema operativo. */
export const THEME_OPTIONS = ['light', 'dark', 'system'];

const STORAGE_KEY = 'fintrack:theme';
const DEFAULT_PREFERENCE = 'light';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Color de la barra del sistema (PWA instalada y navegador móvil) para cada tema; igual al fondo. */
const THEME_COLOR = { light: '#f5f4f9', dark: '#0c0b11' };

const ThemeContext = createContext(null);

/** Lee la preferencia guardada. El almacenamiento puede no estar disponible (modo privado). */
function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEME_OPTIONS.includes(saved) ? saved : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** Suscripción al tema del sistema, para `useSyncExternalStore`. */
function subscribeToSystem(onChange) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const systemIsDark = () => window.matchMedia(DARK_QUERY).matches;

/**
 * Tema de la zona privada. Guarda la preferencia en este dispositivo y, si es "system",
 * sigue en vivo el modo claro u oscuro del sistema operativo.
 *
 * No pinta nada por sí mismo: el contenedor que lo use pone `data-theme={theme}` para que
 * las variables de `index.css` cambien solo dentro de él.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const prefersDark = useSyncExternalStore(subscribeToSystem, systemIsDark);
  const theme = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento: el cambio dura hasta cerrar la app.
    }
  }, []);

  // Barra de estado y controles nativos (scroll, calendario) acordes al tema mientras se está en /app.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = { color: meta?.content, scheme: document.documentElement.style.colorScheme };
    meta?.setAttribute('content', THEME_COLOR[theme]);
    document.documentElement.style.colorScheme = theme;
    return () => {
      if (previous.color) meta?.setAttribute('content', previous.color);
      document.documentElement.style.colorScheme = previous.scheme;
    };
  }, [theme]);

  const value = useMemo(() => ({ theme, preference, setPreference }), [theme, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * @returns {{ theme: 'light'|'dark', preference: 'light'|'dark'|'system', setPreference: (p: string) => void }}
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  return context;
}
