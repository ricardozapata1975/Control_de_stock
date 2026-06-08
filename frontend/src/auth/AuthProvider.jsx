import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const STORAGE_KEY = 'inventario_usuario';
const TOKEN_KEY = 'inventario_admin_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (saved) setUser(JSON.parse(saved));
    if (savedToken) setToken(savedToken);
    setReady(true);
  }, []);

  const persist = useCallback((profile, authToken = null) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUser(profile);
    if (authToken) {
      localStorage.setItem(TOKEN_KEY, authToken);
      setToken(authToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }
  }, []);

  const loginOperario = useCallback(async (nombre) => {
    const data = await api.login({ nombre: nombre.trim() });
    persist(data.user);
    return data.user;
  }, [persist]);

  const loginAdmin = useCallback(async (username, password) => {
    const data = await api.login({ username: username.trim(), password });
    persist(data.user, data.token);
    return data.user;
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loginOperario,
        loginAdmin,
        logout,
        ready,
        isLoggedIn: !!user,
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
