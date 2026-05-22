import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { registerToast } from '../../utils/toastBus';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ message, type = 'info', duration = 3000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    registerToast(showToast);
    return () => registerToast(null);
  }, [showToast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass-card px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl pointer-events-auto animate-[slideIn_0.3s_ease] ${
              t.type === 'success'
                ? 'border-l-4 border-emerald-500'
                : t.type === 'error'
                  ? 'border-l-4 border-red-500'
                  : t.type === 'warning'
                    ? 'border-l-4 border-amber-500'
                    : 'border-l-4 border-indigo-500'
            }`}
          >
            <span className="text-xl">
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <p className="text-sm text-white font-medium">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
