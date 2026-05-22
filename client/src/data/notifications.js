import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  Sparkles,
  Trophy,
} from 'lucide-react';

export const NOTIFICATION_TYPES = {
  SAFE: 'SAFE',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  INSIGHT: 'INSIGHT',
  ACHIEVEMENT: 'ACHIEVEMENT',
};

export const SEVERITY_STYLES = {
  safe: {
    label: 'Safe',
    border: 'border-l-secondary',
    glow: 'hover:shadow-[0_0_20px_rgba(68,226,205,0.25)]',
    badge: 'bg-secondary/20 text-secondary',
    iconBg: 'bg-secondary/15 text-secondary',
    Icon: ShieldCheck,
  },
  warning: {
    label: 'Warning',
    border: 'border-l-tertiary',
    glow: 'hover:shadow-[0_0_20px_rgba(255,182,144,0.3)]',
    badge: 'bg-tertiary/20 text-tertiary',
    iconBg: 'bg-tertiary/15 text-tertiary',
    Icon: AlertTriangle,
  },
  critical: {
    label: 'Critical',
    border: 'border-l-error',
    glow: 'hover:shadow-[0_0_20px_rgba(255,100,90,0.35)]',
    badge: 'bg-error/20 text-error',
    iconBg: 'bg-error/15 text-error',
    Icon: Flame,
  },
  insight: {
    label: 'Insight',
    border: 'border-l-primary-container',
    glow: 'hover:shadow-[0_0_20px_rgba(128,131,255,0.3)]',
    badge: 'bg-primary-container/20 text-primary-container',
    iconBg: 'bg-primary-container/15 text-primary-container',
    Icon: Sparkles,
  },
  achievement: {
    label: 'Achievement',
    border: 'border-l-amber-400',
    glow: 'hover:shadow-[0_0_20px_rgba(251,191,36,0.35)]',
    badge: 'bg-amber-400/20 text-amber-300',
    iconBg: 'bg-amber-400/15 text-amber-300',
    Icon: Trophy,
  },
};

export const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'insights', label: 'Insights' },
  { id: 'achievements', label: 'Achievements' },
];

const SEVERITY_ORDER = { critical: 0, warning: 1, insight: 2, achievement: 3, safe: 4 };

export function sortByPriority(notifications) {
  return [...notifications].sort((a, b) => {
    const pa = a.metadata?.priority ?? SEVERITY_ORDER[a.severity] ?? 5;
    const pb = b.metadata?.priority ?? SEVERITY_ORDER[b.severity] ?? 5;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

export function filterNotifications(notifications, filterId) {
  switch (filterId) {
    case 'alerts':
      return notifications.filter((n) => ['critical', 'warning'].includes(n.severity));
    case 'insights':
      return notifications.filter((n) => n.severity === 'insight');
    case 'achievements':
      return notifications.filter((n) => n.severity === 'achievement');
    default:
      return notifications;
  }
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function groupNotificationsByDate(notifications) {
  const todayStart = startOfDay();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const groups = { today: [], yesterday: [], earlier: [] };

  notifications.forEach((n) => {
    const created = startOfDay(new Date(n.createdAt));
    if (created.getTime() >= todayStart.getTime()) {
      groups.today.push(n);
    } else if (created.getTime() >= yesterdayStart.getTime()) {
      groups.yesterday.push(n);
    } else {
      groups.earlier.push(n);
    }
  });

  return groups;
}

export function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Fallback samples when API is unavailable (dev/demo) */
export const MOCK_NOTIFICATIONS = [
  {
    _id: 'mock-1',
    type: 'INSIGHT',
    severity: 'insight',
    title: 'Food spending spike',
    message: 'You spent 42% more on food this week.',
    isRead: false,
    metadata: { recommendation: 'Try a 2-day snacks freeze.' },
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'mock-2',
    type: 'CRITICAL',
    severity: 'critical',
    title: 'Budget runway alert',
    message: 'At this pace, you may run out of money in 6 days.',
    isRead: false,
    metadata: { recommendation: 'Cut discretionary spending this week.' },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: 'mock-3',
    type: 'SAFE',
    severity: 'safe',
    title: "Today's spending guide",
    message: "Today's safe spending limit: ₹38",
    isRead: true,
    metadata: { recommendation: 'You are within a healthy daily range.' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: 'mock-4',
    type: 'ACHIEVEMENT',
    severity: 'achievement',
    title: 'Safe spending streak',
    message: '5 safe spending days in a row 🔥',
    isRead: false,
    metadata: { recommendation: 'Keep the streak alive tomorrow.' },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    _id: 'mock-5',
    type: 'INSIGHT',
    severity: 'insight',
    title: 'Weekly pattern detected',
    message: 'Transport expenses spike every Friday.',
    isRead: false,
    metadata: { recommendation: 'Pre-plan Friday commute costs.' },
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];
