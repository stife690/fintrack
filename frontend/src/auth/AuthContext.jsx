import { createContext, useContext, useState } from 'react';
import { saveSession, getSession, clearSession } from './tokenStorage';
import { apiFetch } from '@/api/client';
import { login } from '@/services/authService';
import { unsubscribeThisDevice } from '@/services/pushService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSession()?.user ?? null);

  async function signIn(credentials) {
    const session = await login(credentials);
    saveSession(session);
    setUser(session.user);
  }

  async function signOut() {
    const session = getSession();
    try {
      // Antes de perder el token: este dispositivo deja de recibir avisos de esta cuenta.
      await unsubscribeThisDevice();
    } catch {
      // Sin conexión o sin suscripción: no impide cerrar la sesión.
    }
    try {
      await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken: session?.refreshToken } });
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
