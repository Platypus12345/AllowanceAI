import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const loginWithGoogle = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    window.location.href = `${apiBase}/api/auth/google`;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
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
    <AuthContext.Provider value={{ user, setUser, loading, loginWithGoogle, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
