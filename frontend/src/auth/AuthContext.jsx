import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { saveSession, getSession, clearSession } from './tokenStorage';
import { authFetch, SESSION_EXPIRED_EVENT } from '@/lib/authFetch';
import { login, loginWithGoogle } from '@/services/authService';
import { unsubscribeThisDevice } from '@/services/pushService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSession()?.user ?? null);

  // Si la sesión ya no se puede renovar (refresh token vencido o revocado), ProtectedRoute lleva al login.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  async function signIn(credentials) {
    const session = await login(credentials);
    saveSession(session);
    setUser(session.user);
  }

  /** Inicia sesión con el `credential` (id_token) que entrega Google Identity Services. */
  async function signInWithGoogle(credential) {
    const session = await loginWithGoogle(credential);
    saveSession(session);
    setUser(session.user);
  }

  async function signOut() {
    try {
      // Antes de perder el token: este dispositivo deja de recibir avisos de esta cuenta.
      await unsubscribeThisDevice();
    } catch {
      // Sin conexión o sin suscripción: no impide cerrar la sesión.
    }
    try {
      await authFetch('/auth/logout', { method: 'POST', body: () => ({ refreshToken: getSession()?.refreshToken }) });
    } catch {
      // Si falla (sin conexión o token vencido), igual cerramos la sesión local.
    }
    clearSession();
    setUser(null);
  }

  /**
   * Actualiza datos del usuario (p. ej. el nombre) en memoria y en la sesión guardada,
   * sin tocar los tokens. Si no hay sesión no hace nada.
   * @param {Partial<{ name: string|null }>} changes
   */
  const updateUser = useCallback((changes) => {
    const session = getSession();
    if (!session) return;
    const next = { ...session.user, ...changes };
    saveSession({ ...session, user: next });
    setUser(next);
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signInWithGoogle, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
