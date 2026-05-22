import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useNotificationDrawer } from '../context/NotificationDrawerContext';

const NotificationBell = () => {
  const { openDrawer, unreadCount, badgePulse } = useNotificationDrawer();

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="relative p-2 text-slate-400 hover:text-on-surface transition-colors group"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
    >
      <Bell
        size={22}
        className="group-hover:drop-shadow-[0_0_8px_rgba(128,131,255,0.5)] transition-all"
      />
      {unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: badgePulse ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 0.4 }}
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-error text-[10px] font-bold text-white border-2 border-[#0f172a] shadow-[0_0_10px_rgba(255,100,90,0.6)]"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.span>
      )}
    </button>
  );
};

export default NotificationBell;
