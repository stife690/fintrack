import { createContext, useContext, useEffect, useState } from 'react';
import { saveSession, getSession, clearSession } from './tokenStorage';
import { authFetch, SESSION_EXPIRED_EVENT } from '@/lib/authFetch';
import { login } from '@/services/authService';
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

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
