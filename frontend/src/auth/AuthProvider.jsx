import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const STORAGE_KEY = 'inventario_usuario';
const TOKEN_KEY = 'inventario_token';
const LEGACY_TOKEN_KEY = 'inventario_admin_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedToken =
      localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    if (saved && savedToken) {
      setUser(JSON.parse(saved));
      setToken(savedToken);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
    setReady(true);
  }, []);

  const persist = useCallback((profile, authToken) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUser(profile);
    if (authToken) {
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(LEGACY_TOKEN_KEY, authToken);
      setToken(authToken);
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login({ username: username.trim(), password: password || '' });
    return data;
  }, []);

  const completeLogin = useCallback(
    (data) => {
      persist(data.user, data.token);
      return data.user;
    },
    [persist]
  );

  const setPassword = useCallback(
    async ({ setupToken, token: changeToken, newPassword, confirmPassword }) => {
      const data = await api.setPassword({ setupToken, token: changeToken, newPassword, confirmPassword });
      persist(data.user, data.token);
      return data.user;
    },
    [persist]
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        completeLogin,
        setPassword,
        logout,
        ready,
        isLoggedIn: !!user && !!token,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requiere AuthProvider');
  return ctx;
}
