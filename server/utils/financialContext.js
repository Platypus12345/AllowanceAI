const User = require('../models/User');
const Expense = require('../models/Expense');
const BudgetGoal = require('../models/BudgetGoal');
const SavingsJar = require('../models/SavingsJar');
const WishlistItem = require('../models/WishlistItem');
const {
  calculateFinancialHealthFromExpenses,
  getMonthBounds,
} = require('./financialHealth');

/**
 * Single source of truth: user.allowance + month expenses from DB.
 */
async function getFinancialContext(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const date = new Date();
  const { monthStart, month, year } = getMonthBounds(date);

  const expenses = await Expense.find({
    userId,
    date: { $gte: monthStart },
  });
  const goals = await BudgetGoal.find({ userId, month, year });

  const finance = calculateFinancialHealthFromExpenses({
    allowance: user.allowance || 0,
    expenses,
    date,
  });

  const spentByCategory = {
    Food: 0,
    Transport: 0,
    Shopping: 0,
    Entertainment: 0,
    Health: 0,
    Other: 0,
  };
  expenses.forEach((e) => {
    if (spentByCategory[e.category] != null) {
      spentByCategory[e.category] += e.amount;
    }
  });

  const categoryBreakdown = {};
  for (const goal of goals) {
    const catSpent = spentByCategory[goal.category] || 0;
    categoryBreakdown[goal.category] = {
      limit: goal.monthlyLimit,
      spent: catSpent,
      percentage:
        goal.monthlyLimit > 0 ? Math.round((catSpent / goal.monthlyLimit) * 100) : 0,
    };
  }

  const topCategories = Object.entries(spentByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, spent: amount }));

  const jars = await SavingsJar.find({ userId, status: { $in: ['active', 'paused'] } });
  const jarsSummary = jars.map((j) => ({
    name: j.name,
    target: j.targetAmount,
    current: j.currentAmount,
    percent: j.targetAmount > 0 ? Math.round((j.currentAmount / j.targetAmount) * 100) : 0,
  }));

  const wishlist = await WishlistItem.find({ userId, status: 'tracking' });
  const wishlistSummary = wishlist.map((w) => ({
    name: w.name,
    currentPrice: w.currentPrice,
    targetPrice: w.targetPrice,
    affordable:
      w.currentPrice != null && w.currentPrice <= finance.recommendedDailyLimit,
  }));

  return {
    finance,
    ...finance,
    jarsSummary,
    wishlistSummary,
    allowance: finance.allowance,
    spent: finance.totalSpent,
    remaining: finance.remainingBalance,
    daily_limit: finance.recommendedDailyLimit,
    days_left: finance.daysLeftInMonth,
    daysLeft: finance.daysLeftInMonth,
    daysElapsed: finance.daysElapsed,
    dailyAverage: finance.avgDailySpend,
    projectedLeftover: finance.projectedMonthEndBalance,
    projectedMonthEndBalance: finance.projectedMonthEndBalance,
    spentToday: finance.spentToday,
    survival: finance.survival,
    categoryBreakdown,
    top_categories: topCategories,
    aiPersonality: user.aiPersonality || 'supportive',
  };
}

module.exports = { getFinancialContext };
