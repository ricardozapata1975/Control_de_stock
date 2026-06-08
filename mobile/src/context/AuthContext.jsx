import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setApiToken } from '../services/api';

const AUTH_KEY = '@inventario/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY).then((raw) => {
      if (raw) {
        const data = JSON.parse(raw);
        setUser(data);
        setApiToken(data.token || null);
      }
      setLoading(false);
    });
  }, []);

  const loginDemo = useCallback(async (nombre) => {
    const data = {
      name: nombre.trim(),
      email: `${nombre.trim().toLowerCase().replace(/\s+/g, '.')}@taller.local`,
      demo: true,
      token: null,
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(data));
    setApiToken(null);
    setUser(data);
    return data;
  }, []);

  const loginMicrosoft = useCallback(async () => {
    const data = {
      name: 'Usuario Microsoft',
      demo: false,
      token: 'placeholder-token',
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(data));
    setApiToken(data.token);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setApiToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginDemo, loginMicrosoft, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requiere AuthProvider');
  return ctx;
}
