const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const User = require('../models/User');
const AllowanceRequest = require('../models/AllowanceRequest');
const verifyJWT = require('../middleware/verifyJWT');
const {
  calculateFinancialHealth,
  calculateDayMetrics,
  getMonthBounds,
  sumTodaySpend,
} = require('../utils/financialHealth');

router.use(verifyJWT);

function resolveMonthYear(req) {
  const now = new Date();
  const month = req.query.month != null ? parseInt(req.query.month, 10) : now.getMonth() + 1;
  const year = req.query.year != null ? parseInt(req.query.year, 10) : now.getFullYear();
  return { month, year };
}

function monthDateRange(month, year) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function toDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCategoryKey(category) {
  return category ? category.toLowerCase().replace(/\s+/g, '_') : 'other';
}

function computeSafeSpendingStreak(dayEntries, dailyLimit) {
  const sorted = [...dayEntries]
    .filter((d) => d.spent > 0 || d.allowanceAdded > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let current = 0;
  let max = 0;
  for (const day of sorted) {
    const isSafe = day.spent <= dailyLimit;
    if (isSafe) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

function monthlyMoodLabel(avgRatio) {
  if (avgRatio <= 0.55) return 'Conservative Saver';
  if (avgRatio <= 0.85) return 'Balanced Spender';
  if (avgRatio <= 1.1) return 'Active Spender';
  return 'High-Risk Spender';
}

router.get('/calendar', async (req, res) => {
  try {
    const { month, year } = resolveMonthYear(req);
    const { start, end } = monthDateRange(month, year);
    const daysInMonth = new Date(year, month, 0).getDate();

    const user = await User.findById(req.userId);
    const totalAllowance = user?.allowance || 0;
    const now = new Date();
    const todayKey = toDateKey(now);
    const isCurrentMonth =
      now.getMonth() + 1 === month && now.getFullYear() === year;
    const monthBaselineDaily =
      totalAllowance > 0 ? totalAllowance / daysInMonth : 0;

    const [expenses, approvedRequests] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      AllowanceRequest.find({
        userId: req.userId,
        status: 'approved',
        date: { $gte: start, $lte: end },
      }),
    ]);

    const dayMap = {};

    const ensureDay = (dateKey) => {
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          date: dateKey,
          spent: 0,
          transactions: 0,
          allowanceAdded: 0,
          categories: {},
          biggestExpense: null,
        };
      }
      return dayMap[dateKey];
    };

    expenses.forEach((expense) => {
      const key = toDateKey(expense.date);
      const day = ensureDay(key);
      day.spent += expense.amount;
      day.transactions += 1;
      const catKey = formatCategoryKey(expense.category);
      day.categories[catKey] = (day.categories[catKey] || 0) + expense.amount;

      if (!day.biggestExpense || expense.amount > day.biggestExpense.amount) {
        day.biggestExpense = {
          description: expense.description || expense.category,
          category: expense.category,
          amount: expense.amount,
        };
      }
    });

    approvedRequests.forEach((request) => {
      const key = toDateKey(request.date);
      const day = ensureDay(key);
      day.allowanceAdded += request.amount;
    });

    const totalMonthSpent = expenses.reduce((acc, e) => acc + e.amount, 0);
    const spentToday = isCurrentMonth ? sumTodaySpend(expenses) : 0;
    const { daysLeft, daysElapsed } = isCurrentMonth
      ? getMonthBounds(now)
      : { daysLeft: 1, daysElapsed: daysInMonth };

    const monthHealth = isCurrentMonth
      ? calculateFinancialHealth({
          allowance: totalAllowance,
          totalSpent: totalMonthSpent,
          spentToday,
          daysLeftInMonth: daysLeft,
          daysElapsed,
          daysInMonth,
        })
      : null;

    const recommendedDailyLimit = monthHealth
      ? monthHealth.recommendedDailyLimit
      : Math.round(monthBaselineDaily);

    const days = Object.values(dayMap)
      .map((day) => {
        const isToday = isCurrentMonth && day.date === todayKey;
        const daySafeLimit = isToday && monthHealth
          ? monthHealth.recommendedDailyLimit
          : Math.round(monthBaselineDaily);
        const metrics = calculateDayMetrics(day.spent, daySafeLimit);
        return {
          ...day,
          level: metrics.level,
          mood: metrics.moodLabel,
          spendingStatus: metrics.spendingStatus,
          savingsScore: metrics.savingsScore,
          usagePercent: metrics.usagePercent,
          recommendedDailyLimit: Math.round(daySafeLimit),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const spentDays = days.filter((d) => d.spent > 0);
    const totalSpent = spentDays.reduce((acc, d) => acc + d.spent, 0);
    const avgDailySpent = spentDays.length > 0 ? totalSpent / spentDays.length : 0;
    const avgRatio =
      monthBaselineDaily > 0 ? avgDailySpent / monthBaselineDaily : 0;

    let worstDay = null;
    spentDays.forEach((d) => {
      if (!worstDay || d.spent > worstDay.spent) worstDay = d;
    });

    const safeStreak = computeSafeSpendingStreak(
      days,
      monthHealth ? monthHealth.recommendedDailyLimit : monthBaselineDaily
    );

    const midMonth = Math.floor(daysInMonth / 2);
    const firstHalfFood = expenses
      .filter((e) => {
        const d = new Date(e.date).getDate();
        return e.category === 'Food' && d <= midMonth;
      })
      .reduce((acc, e) => acc + e.amount, 0);
    const secondHalfFood = expenses
      .filter((e) => {
        const d = new Date(e.date).getDate();
        return e.category === 'Food' && d > midMonth;
      })
      .reduce((acc, e) => acc + e.amount, 0);

    let categorySpike = null;
    if (firstHalfFood > 0 && secondHalfFood > firstHalfFood) {
      const increase = Math.round(((secondHalfFood - firstHalfFood) / firstHalfFood) * 100);
      if (increase >= 20) {
        categorySpike = {
          category: 'Food',
          increasePercent: increase,
          message: `Your food spending increased ${increase}% in the second half of the month.`,
        };
      }
    }

    let predictiveAlert = null;
    if (
      isCurrentMonth &&
      monthHealth &&
      monthHealth.projectedMonthEndBalance < 0
    ) {
      const daysUntilOver =
        monthHealth.avgDailySpend > 0
          ? Math.ceil(monthHealth.remainingBalance / monthHealth.avgDailySpend)
          : 1;
      predictiveAlert = {
        message: `If this pace continues, you may exceed budget in ${Math.max(daysUntilOver, 1)} day${daysUntilOver === 1 ? '' : 's'}.`,
        daysUntilOverBudget: Math.max(daysUntilOver, 1),
      };
    } else if (
      isCurrentMonth &&
      monthHealth &&
      monthHealth.remainingBalance > 0 &&
      monthHealth.avgDailySpend > 0
    ) {
      const runway = Math.ceil(
        monthHealth.remainingBalance / monthHealth.avgDailySpend
      );
      if (runway < monthHealth.daysLeftInMonth) {
        predictiveAlert = {
          message: `If this pace continues, you may exceed budget in ${runway} day${runway === 1 ? '' : 's'}.`,
          daysUntilOverBudget: runway,
        };
      }
    }

    res.json({
      month,
      year,
      dailyLimit: Math.round(recommendedDailyLimit),
      finance: monthHealth,
      totalAllowance,
      days,
      insights: {
        safeSpendingStreak: safeStreak,
        worstDay: worstDay
          ? { date: worstDay.date, spent: worstDay.spent }
          : null,
        monthlyMood: monthlyMoodLabel(avgRatio),
        categorySpike,
        predictiveAlert,
        totalSpent,
        daysWithSpending: spentDays.length,
      },
    });
  } catch (error) {
    console.error('Calendar stats error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar stats' });
  }
});

module.exports = router;
