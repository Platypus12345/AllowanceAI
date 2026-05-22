import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { useNotificationDrawer } from '../context/NotificationDrawerContext';
import { subscribeFinanceUpdated } from '../utils/financeEvents';
import NotificationCard from './NotificationCard';
import {
  FILTER_TABS,
  filterNotifications,
  groupNotificationsByDate,
  sortByPriority,
  MOCK_NOTIFICATIONS,
} from '../data/notifications';

const GROUP_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
};

const NotificationDrawer = () => {
  const { open, closeDrawer, setUnreadCount } = useNotificationDrawer();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount ?? 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
      setNotifications(MOCK_NOTIFICATIONS);
      setUnreadCount(MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length);
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeFinanceUpdated(fetchNotifications);
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeDrawer]);

  const filtered = useMemo(() => {
    const sorted = sortByPriority(notifications);
    return filterNotifications(sorted, activeFilter);
  }, [notifications, activeFilter]);

  const grouped = useMemo(() => groupNotificationsByDate(filtered), [filtered]);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/notifications/read/${id}`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const unreadInView = filtered.filter((n) => !n.isRead).length;

  const renderGroup = (key) => {
    const items = grouped[key];
    if (!items?.length) return null;
    let idx = 0;
    return (
      <div key={key} className="space-y-3">
        <h3 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 px-1">
          {GROUP_LABELS[key]}
        </h3>
        {items.map((n) => {
          const card = (
            <NotificationCard
              key={n._id}
              notification={n}
              index={idx}
              onRead={handleMarkRead}
            />
          );
          idx += 1;
          return card;
        })}
      </div>
    );
  };

  const overlay = (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overlay-backdrop"
            onClick={closeDrawer}
            aria-label="Close notifications"
          />

          <motion.aside
            key="notif-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="AI Notifications"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="overlay-drawer"
          >
            <header className="overlay-drawer-header flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-primary-container" />
                    <h2 className="font-plus font-black text-lg text-on-surface">AI Notifications</h2>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {unreadInView > 0
                      ? `${unreadInView} unread insight${unreadInView === 1 ? '' : 's'}`
                      : 'All caught up'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-2 rounded-xl hover:bg-white/10 text-on-surface-variant transition-colors shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {unreadInView > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs font-plus font-semibold text-primary-container hover:text-primary transition-colors px-3 py-1.5 rounded-lg bg-primary-container/10"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </header>

            <div className="px-4 pb-3 border-b border-white/10 shrink-0">
              <div className="flex gap-2 overflow-x-auto scrollbar-none">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={`
                      shrink-0 px-3 py-1.5 rounded-full text-xs font-plus font-bold transition-all
                      ${
                        activeFilter === tab.id
                          ? 'bg-primary-container text-on-primary-container shadow-[0_0_12px_rgba(128,131,255,0.35)]'
                          : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overlay-drawer-body">
              {loading ? (
                <div className="flex flex-col items-center py-16 animate-pulse">
                  <Sparkles size={40} className="text-primary-container/30 mb-3" />
                  <p className="text-on-surface-variant text-sm font-plus">
                    AI is analyzing your finances...
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center text-center py-16 px-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mb-4">
                    <Sparkles size={28} className="text-secondary" />
                  </div>
                  <h3 className="font-plus font-bold text-on-surface mb-2">
                    You&apos;re financially stable today ✨
                  </h3>
                  <p className="text-sm text-on-surface-variant max-w-[260px]">
                    No {activeFilter === 'all' ? '' : `${activeFilter} `}alerts right now. Keep
                    tracking expenses to unlock smarter insights.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {renderGroup('today')}
                  {renderGroup('yesterday')}
                  {renderGroup('earlier')}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
};

export default NotificationDrawer;
