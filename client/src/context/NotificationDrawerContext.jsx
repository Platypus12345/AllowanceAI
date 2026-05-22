import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import api from '../api/axios';
import { subscribeFinanceUpdated } from '../utils/financeEvents';

const NotificationDrawerContext = createContext(null);

export function NotificationDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgePulse, setBadgePulse] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      const count = res.data.unreadCount ?? 0;
      setUnreadCount((prev) => {
        if (count > prev) setBadgePulse(true);
        return count;
      });
    } catch {
      /* ignore — drawer will handle empty state */
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    return subscribeFinanceUpdated(refreshUnreadCount);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!badgePulse) return undefined;
    const t = setTimeout(() => setBadgePulse(false), 1200);
    return () => clearTimeout(t);
  }, [badgePulse]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openDrawer: () => setOpen(true),
      closeDrawer: () => setOpen(false),
      unreadCount,
      setUnreadCount,
      badgePulse,
      refreshUnreadCount,
    }),
    [open, unreadCount, badgePulse, refreshUnreadCount]
  );

  return (
    <NotificationDrawerContext.Provider value={value}>
      {children}
    </NotificationDrawerContext.Provider>
  );
}

export function useNotificationDrawer() {
  const ctx = useContext(NotificationDrawerContext);
  if (!ctx) {
    throw new Error('useNotificationDrawer must be used within NotificationDrawerProvider');
  }
  return ctx;
}
