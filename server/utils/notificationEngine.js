const Expense = require('../models/Expense');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { calculateFinancialHealth, sumTodaySpend } = require('./financialHealth');

const PRIORITY = {
  CRITICAL: 0,
  WARNING: 1,
  INSIGHT: 2,
  ACHIEVEMENT: 3,
  SAFE: 4,
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n) {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
}

function formatInr(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function weekRange(offsetWeeks = 0) {
  const end = startOfDay();
  end.setDate(end.getDate() - offsetWeeks * 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function sumExpenses(expenses) {
  return expenses.reduce((acc, e) => acc + e.amount, 0);
}

function categoryTotals(expenses) {
  return expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
}

function computeSafeStreak(expenses, dailyLimit) {
  const byDay = {};
  expenses.forEach((e) => {
    const key = startOfDay(e.date).toISOString();
    byDay[key] = (byDay[key] || 0) + e.amount;
  });
  const keys = Object.keys(byDay).sort();
  let current = 0;
  let max = 0;
  keys.forEach((k) => {
    if (byDay[k] <= dailyLimit) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  });
  return max;
}

function fridayTransportSpike(expenses) {
  const friday = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getDay() === 5 && e.category === 'Transport';
  });
  const other = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getDay() !== 5 && e.category === 'Transport';
  });
  if (friday.length < 2) return null;
  const friAvg = sumExpenses(friday) / friday.length;
  const otherAvg = other.length ? sumExpenses(other) / other.length : 0;
  if (otherAvg > 0 && friAvg >= otherAvg * 1.35) {
    return true;
  }
  return friday.length >= 3 && sumExpenses(friday) > 150;
}

async function buildNotificationCandidates(userId) {
  const user = await User.findById(userId);
  if (!user) return [];

  const now = new Date();
  const allowance = user.allowance || 0;
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysLeft = daysInMonth - daysElapsed + 1;
  const dailyBudget = allowance > 0 ? allowance / daysInMonth : 0;

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [monthExpenses, thisWeekExpenses, lastWeekExpenses, todayExpenses] = await Promise.all([
    Expense.find({ userId, date: { $gte: monthStart, $lte: monthEnd } }),
    Expense.find({ userId, date: { $gte: weekRange(0).start, $lte: weekRange(0).end } }),
    Expense.find({ userId, date: { $gte: weekRange(1).start, $lte: weekRange(1).end } }),
    Expense.find({ userId, date: { $gte: startOfDay(now), $lte: todayEnd } }),
  ]);

  const monthSpent = sumExpenses(monthExpenses);
  const spentToday = sumTodaySpend(monthExpenses);
  const finance = calculateFinancialHealth({
    allowance,
    totalSpent: monthSpent,
    spentToday,
    daysLeftInMonth: daysLeft,
    daysElapsed,
    daysInMonth,
  });
  const survival = finance.survival;
  const remaining = finance.remainingBalance;
  const dailyAverage = finance.avgDailySpend;
  const candidates = [];

  if (allowance > 0 && dailyAverage > 0 && remaining > 0) {
    const daysUntilOut = Math.ceil(remaining / dailyAverage);
    if (daysUntilOut <= daysLeft && daysUntilOut <= 14) {
      candidates.push({
        type: 'CRITICAL',
        severity: 'critical',
        title: 'Budget runway alert',
        message: `At this pace, you may run out of money in ${daysUntilOut} day${daysUntilOut === 1 ? '' : 's'}.`,
        metadata: {
          key: `runout-${now.getFullYear()}-${now.getMonth()}`,
          recommendation: 'Pause non-essential spending for 48 hours.',
          priority: PRIORITY.CRITICAL,
        },
      });
    }
  }

  if (finance.spendingStatus === 'DANGER' && allowance > 0) {
    candidates.push({
      type: 'CRITICAL',
      severity: 'critical',
      title: 'Survival mode',
      message: survival.message,
      metadata: {
        key: `survival-danger-${now.getFullYear()}-${now.getMonth()}`,
        recommendation: 'Review your largest categories and set a daily cap.',
        priority: PRIORITY.CRITICAL,
      },
    });
  } else if (finance.spendingStatus === 'WARNING' || finance.spendingStatus === 'MODERATE') {
    candidates.push({
      type: 'WARNING',
      severity: 'warning',
      title: 'Tight budget zone',
      message: survival.message,
      metadata: {
        key: `survival-tight-${now.getFullYear()}-${now.getMonth()}`,
        recommendation: `Today's safe spending limit: ${formatInr(survival.recommendedDailyLimit)}`,
        priority: PRIORITY.WARNING,
      },
    });
  }

  if (survival.recommendedDailyLimit > 0) {
    const todaySpent = sumExpenses(todayExpenses);
    candidates.push({
      type: 'SAFE',
      severity: 'safe',
      title: "Today's spending guide",
      message: `Today's safe spending limit: ${formatInr(Math.max(0, survival.recommendedDailyLimit - todaySpent))}`,
      metadata: {
        key: `daily-limit-${now.toISOString().slice(0, 10)}`,
        recommendation: 'Stay under this amount to finish the month comfortably.',
        priority: PRIORITY.SAFE,
      },
    });
  }

  const thisWeekByCat = categoryTotals(thisWeekExpenses);
  const lastWeekByCat = categoryTotals(lastWeekExpenses);

  Object.keys(thisWeekByCat).forEach((category) => {
    const current = thisWeekByCat[category] || 0;
    const previous = lastWeekByCat[category] || 0;
    if (previous > 0 && current > previous * 1.2 && current - previous >= 50) {
      const pct = Math.round(((current - previous) / previous) * 100);
      candidates.push({
        type: 'INSIGHT',
        severity: 'insight',
        title: `${category} spending spike`,
        message: `You spent ${pct}% more on ${category.toLowerCase()} this week.`,
        metadata: {
          key: `spike-${category}-${now.getFullYear()}-${now.getMonth()}-${Math.ceil(now.getDate() / 7)}`,
          recommendation: `Try a ${category} freeze for 2 days.`,
          category,
          priority: PRIORITY.INSIGHT,
        },
      });
    }
  });

  if (fridayTransportSpike(monthExpenses)) {
    candidates.push({
      type: 'INSIGHT',
      severity: 'insight',
      title: 'Weekly pattern detected',
      message: 'Transport expenses spike every Friday.',
      metadata: {
        key: `friday-transport-${now.getFullYear()}-${now.getMonth()}`,
        recommendation: 'Pre-book rides or use campus shuttle on Fridays.',
        category: 'Transport',
        priority: PRIORITY.INSIGHT,
      },
    });
  }

  const underBudget = remaining;
  if (underBudget >= 100 && monthSpent < allowance * 0.85) {
    candidates.push({
      type: 'INSIGHT',
      severity: 'insight',
      title: 'Under budget',
      message: `You are under budget by ${formatInr(underBudget)}.`,
      metadata: {
        key: `under-budget-${now.getFullYear()}-${now.getMonth()}`,
        recommendation: 'Consider moving extra into savings goals.',
        priority: PRIORITY.INSIGHT,
      },
    });
  }

  const entertainment = thisWeekByCat.Entertainment || 0;
  const entPrev = lastWeekByCat.Entertainment || 0;
  if (entertainment > 300 && entertainment > entPrev * 1.4) {
    candidates.push({
      type: 'WARNING',
      severity: 'warning',
      title: 'Entertainment alert',
      message: 'Entertainment spending is unusually high.',
      metadata: {
        key: `ent-high-${now.getFullYear()}-${now.getMonth()}`,
        recommendation: 'Swap one outing for a free campus event this week.',
        category: 'Entertainment',
        priority: PRIORITY.WARNING,
      },
    });
  }

  const safeStreak = computeSafeStreak(monthExpenses, dailyBudget);
  if (safeStreak >= 3) {
    candidates.push({
      type: 'ACHIEVEMENT',
      severity: 'achievement',
      title: 'Safe spending streak',
      message: `${safeStreak} safe spending days in a row 🔥`,
      metadata: {
        key: `streak-${safeStreak}-${now.toISOString().slice(0, 10)}`,
        recommendation: 'Keep it up — you are building strong habits.',
        priority: PRIORITY.ACHIEVEMENT,
      },
    });
  }

  if (finance.monthHealthScore >= 60 && finance.spendingStatus === 'SAFE') {
    candidates.push({
      type: 'SAFE',
      severity: 'safe',
      title: 'Financially stable',
      message: "You're on track this month with healthy savings.",
      metadata: {
        key: `stable-${now.toISOString().slice(0, 10)}`,
        recommendation: 'Maintain current spending rhythm.',
        priority: PRIORITY.SAFE,
      },
    });
  }

  return candidates;
}

async function upsertNotifications(userId, candidates) {
  for (const item of candidates) {
    await Notification.findOneAndUpdate(
      { userId, 'metadata.key': item.metadata.key },
      {
        $set: {
          userId,
          type: item.type,
          title: item.title,
          message: item.message,
          severity: item.severity,
          metadata: item.metadata,
        },
        $setOnInsert: { isRead: false },
      },
      { upsert: true, new: true }
    );
  }
}

async function syncSmartNotifications(userId) {
  const candidates = await buildNotificationCandidates(userId);
  await upsertNotifications(userId, candidates);
  return candidates.length;
}

function sortNotifications(list) {
  const order = { critical: 0, warning: 1, insight: 2, achievement: 3, safe: 4 };
  return [...list].sort((a, b) => {
    const pa = a.metadata?.priority ?? order[a.severity] ?? 5;
    const pb = b.metadata?.priority ?? order[b.severity] ?? 5;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

module.exports = {
  syncSmartNotifications,
  sortNotifications,
  PRIORITY,
};
