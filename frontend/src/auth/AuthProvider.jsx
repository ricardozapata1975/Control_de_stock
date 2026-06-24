import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';
import { isAdminRole } from '../utils/role';

const STORAGE_KEY = 'inventario_usuario';
const TOKEN_KEY = 'inventario_token';
const LEGACY_TOKEN_KEY = 'inventario_admin_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const sessionTokenRef = useRef(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionTokenRef.current = null;
    setUser(null);
    setToken(null);
  }, []);

  const persist = useCallback((profile, authToken) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUser(profile);
    if (authToken) {
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(LEGACY_TOKEN_KEY, authToken);
      sessionTokenRef.current = authToken;
      setToken(authToken);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const savedToken =
      sessionTokenRef.current ||
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!savedToken) return null;

    try {
      const data = await api.me();
      if (data?.user) {
        persist(data.user, savedToken);
        return data.user;
      }
    } catch {
      clearSession();
    }
    return null;
  }, [clearSession, persist]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedToken =
        localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);

      if (!saved || !savedToken) {
        clearSession();
        if (!cancelled) setReady(true);
        return;
      }

      sessionTokenRef.current = savedToken;
      setUser(JSON.parse(saved));
      setToken(savedToken);

      try {
        await refreshSession();
      } catch {
        /* logout ya aplicado en refreshSession si corresponde */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession, refreshSession]);

  const login = useCallback(async (username, password) => {
    const data = await api.login({ username: username.trim(), password: password || '' });
    return data;
  }, []);

  const beginFirstLogin = useCallback(async (username) => {
    const data = await api.firstLogin({ username: username.trim() });
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

  const isAdmin = isAdminRole(user?.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        beginFirstLogin,
        completeLogin,
        setPassword,
        logout,
        refreshSession,
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
