import { motion } from 'framer-motion';
import { SEVERITY_STYLES, formatRelativeTime } from '../data/notifications';

const NotificationCard = ({ notification, index, onRead }) => {
  const style = SEVERITY_STYLES[notification.severity] || SEVERITY_STYLES.insight;
  const { Icon } = style;
  const isUnread = !notification.isRead;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={() => isUnread && onRead?.(notification._id)}
      className={`
        notification-card glass-card rounded-2xl p-4 border-l-4 cursor-pointer
        transition-all duration-200 hover:scale-[1.02]
        ${style.border} ${style.glow}
        ${isUnread ? 'notification-card-unread' : 'opacity-80'}
      `}
    >
      <div className="flex gap-3">
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${style.iconBg}`}
        >
          <Icon size={20} strokeWidth={2.25} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-plus font-bold text-sm text-on-surface leading-snug">
              {notification.title}
            </h4>
            <span
              className={`shrink-0 text-[9px] font-plus font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.badge}`}
            >
              {style.label}
            </span>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed mb-2">
            {notification.message}
          </p>

          {notification.metadata?.recommendation && (
            <p className="text-[11px] text-primary-container/90 bg-primary-container/10 rounded-lg px-2.5 py-1.5 mb-2 leading-relaxed">
              <span className="font-semibold text-primary-container">AI tip: </span>
              {notification.metadata.recommendation}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-plus">
              {formatRelativeTime(notification.createdAt)}
            </span>
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-error shadow-[0_0_8px_rgba(255,100,90,0.8)]" />
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default NotificationCard;
