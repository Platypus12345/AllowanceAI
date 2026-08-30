import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { wakeApiServer } from '../utils/wakeApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const legacy = localStorage.getItem('token');
      if (legacy && !localStorage.getItem('authToken')) {
        localStorage.setItem('authToken', legacy);
        localStorage.removeItem('token');
      }

      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Warm Render API in background when app loads (reduces login wait)
  useEffect(() => {
    wakeApiServer(2, 2000).catch(() => {});
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (googleLoginLoading) return { ok: false, reason: 'busy' };

    setGoogleLoginLoading(true);
    try {
      const result = await wakeApiServer(15, 4000);
      if (!result.ok) {
        setGoogleLoginLoading(false);
        return { ok: false, reason: 'api_cold_start' };
      }

      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
      window.location.href = `${apiBase}/api/auth/google`;
      return { ok: true };
    } catch {
      setGoogleLoginLoading(false);
      return { ok: false, reason: 'unknown' };
    }
  }, [googleLoginLoading]);

  const cancelGoogleLoginLoading = useCallback(() => {
    setGoogleLoginLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setUser(null);
  };

  const refreshAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (error) {
      console.error('Auth refresh failed:', error);
      localStorage.removeItem('authToken');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        googleLoginLoading,
        loginWithGoogle,
        cancelGoogleLoginLoading,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
