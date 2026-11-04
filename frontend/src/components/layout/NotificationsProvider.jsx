import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/auth/AuthContext';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { createNotificationStore } from '@/lib/notificationStore';
import { getNotifications, markNotificationsRead } from '@/services/notificationService';

/** Cada cuánto se revisa si llegó algo nuevo mientras la app está abierta. */
const REFRESH_MS = 60_000;

const NotificationsContext = createContext(null);

/**
 * El marco de la app se vuelve a montar en cada cambio de ruta (`ErrorBoundary key={pathname}`), así
 * que los avisos viven fuera de React para no perderlos ni volver a pedirlos en cada pantalla.
 * Son de una persona: si cambia la sesión, se empieza de cero.
 */
let current = null;

function storeFor(owner) {
  if (current?.owner !== owner) {
    current = {
      owner,
      store: createNotificationStore({ fetchAll: getNotifications, markAll: markNotificationsRead }),
    };
  }
  return current.store;
}

/**
 * Consulta los avisos en un solo lugar: la campana y el avatar leen de aquí, se muestren o no.
 * Se actualiza al abrir la app, al volver a la pestaña y cada minuto; sin conexión no pregunta.
 */
export function NotificationsProvider({ children }) {
  const online = useOnlineStatus();
  const { user } = useAuth();
  const store = storeFor(user?.id ?? user?.email);

  useEffect(() => {
    if (!online) return undefined;
    const onVisible = () => document.visibilityState === 'visible' && store.load();
    store.loadIfStale(REFRESH_MS);
    const timer = setInterval(onVisible, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [online, store]);

  return <NotificationsContext.Provider value={store}>{children}</NotificationsContext.Provider>;
}

/**
 * @returns {{ items: object[], unread: number, status: string, markRead: () => Promise<void>, clearHighlights: () => void }}
 */
export function useNotifications() {
  const store = useContext(NotificationsContext);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { ...state, markRead: store.markRead, clearHighlights: store.clearHighlights };
}
