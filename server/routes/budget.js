const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Expense = require('../models/Expense');
const BudgetGoal = require('../models/BudgetGoal');
const verifyJWT = require('../middleware/verifyJWT');
const {
  calculateFinancialHealth,
  getMonthBounds,
  sumTodaySpend,
} = require('../utils/financialHealth');
const { syncSmartNotifications } = require('../utils/notificationEngine');

router.use(verifyJWT);

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

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

router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { monthStart, daysInMonth, daysElapsed, daysLeftInMonth } = getMonthBounds();
    const expenses = await Expense.find({
      userId: req.userId,
      date: { $gte: monthStart },
    });

    const totalAllowance = user.allowance || 0;
    const spentAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const spentToday = sumTodaySpend(expenses);

    const finance = calculateFinancialHealth({
      allowance: totalAllowance,
      totalSpent: spentAmount,
      spentToday,
      daysLeftInMonth,
      daysElapsed,
      daysInMonth,
    });

    // Grouping by category for Recharts pie chart
    const spendingByCategory = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {
      Food: 0, Transport: 0, Shopping: 0, Entertainment: 0, Health: 0, Other: 0
    });

    const chartData = Object.keys(spendingByCategory).map(key => ({
      name: key,
      value: spendingByCategory[key]
    }));

    res.json({
      totalAllowance,
      spentAmount,
      spentToday,
      remainingBalance: finance.remainingBalance,
      dailyLimit: finance.recommendedDailyLimit,
      chartData,
      daysLeftInMonth,
      streak: user.streak || 0,
      badges: user.badges || [],
      finance,
      health: finance,
      survival: finance.survival,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch budget stats' });
  }
});

router.get('/prediction', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { monthStart, daysInMonth, daysElapsed, daysLeftInMonth } = getMonthBounds();
    const expenses = await Expense.find({
      userId: req.userId,
      date: { $gte: monthStart },
    });

    const totalAllowance = user.allowance || 0;
    const spent = expenses.reduce((acc, e) => acc + e.amount, 0);
    const spentToday = sumTodaySpend(expenses);

    const finance = calculateFinancialHealth({
      allowance: totalAllowance,
      totalSpent: spent,
      spentToday,
      daysLeftInMonth,
      daysElapsed,
      daysInMonth,
    });

    const willRunOut = finance.projectedMonthEndBalance < 0;
    let projectedRunoutDate = null;
    if (willRunOut && finance.avgDailySpend > 0) {
      const safeDays = Math.ceil(finance.remainingBalance / finance.avgDailySpend);
      const runout = new Date();
      runout.setDate(runout.getDate() + Math.max(safeDays, 1));
      projectedRunoutDate = runout.toISOString();
    }

    res.json({
      finance,
      dailyAverage: finance.avgDailySpend,
      projectedTotal: finance.totalSpent + finance.avgDailySpend * (daysLeftInMonth - 1),
      projectedMonthEndBalance: finance.projectedMonthEndBalance,
      projectedRunoutDate,
      daysLeft: finance.daysLeftInMonth,
      willRunOut,
      safeDays:
        finance.avgDailySpend > 0
          ? Math.floor(finance.remainingBalance / finance.avgDailySpend)
          : finance.daysLeftInMonth,
      spendingStatus: finance.spendingStatus,
      insights: finance.insights,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate prediction' });
  }
});

router.get('/report', async (req, res) => {
  try {
    const { month, year } = resolveMonthYear(req);
    const { start, end } = monthDateRange(month, year);

    // Get previous month dates
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const { start: prevStart, end: prevEnd } = monthDateRange(prevMonth, prevYear);

    const user = await User.findById(req.userId);
    const [expenses, prevExpenses] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Expense.find({ userId: req.userId, date: { $gte: prevStart, $lte: prevEnd } })
    ]);

    const totalAllowance = user.allowance || 0;
    const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const prevTotalSpent = prevExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    
    const savingsAmount = Math.max(0, totalAllowance - totalSpent);
    const savingsPercent = totalAllowance > 0 ? (savingsAmount / totalAllowance) * 100 : 0;

    const categoryBreakdown = CATEGORIES.reduce((acc, c) => {
      acc[c] = 0;
      return acc;
    }, {});
    
    let biggestExpense = null;
    const daysSpent = new Set();
    
    expenses.forEach(e => {
      if (categoryBreakdown[e.category] != null) {
        categoryBreakdown[e.category] += e.amount;
      }
      if (!biggestExpense || e.amount > biggestExpense.amount) {
        biggestExpense = e;
      }
      daysSpent.add(e.date.toISOString().split('T')[0]);
    });

    let bestCategory = null;
    let worstCategory = null;
    let maxSpend = -1;
    let minSpend = Infinity;

    Object.keys(categoryBreakdown).forEach(c => {
      const amt = categoryBreakdown[c];
      if (amt > maxSpend) {
        maxSpend = amt;
        worstCategory = c;
      }
      if (amt < minSpend) {
        minSpend = amt;
        bestCategory = c;
      }
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyAverageSpend = daysSpent.size > 0 ? totalSpent / daysSpent.size : 0;
    const expectedDailyLimit = totalAllowance / daysInMonth;

    // Simple calculation for daysOverLimit
    let daysOverLimit = 0;
    const dailySpendMap = {};
    expenses.forEach(e => {
      const d = e.date.toISOString().split('T')[0];
      dailySpendMap[d] = (dailySpendMap[d] || 0) + e.amount;
    });
    Object.values(dailySpendMap).forEach(amt => {
      if (amt > expectedDailyLimit) daysOverLimit++;
    });

    let grade = 'A';
    const spentPercent = totalAllowance > 0 ? (totalSpent / totalAllowance) * 100 : 0;
    if (spentPercent > 100) grade = 'F';
    else if (spentPercent >= 95) grade = 'D';
    else if (spentPercent >= 85) grade = 'C';
    else if (spentPercent >= 70) grade = 'B';

    res.json({
      month,
      year,
      totalSpent,
      totalAllowance,
      savingsAmount,
      savingsPercent,
      categoryBreakdown,
      biggestExpense,
      bestCategory,
      worstCategory,
      dailyAverageSpend,
      daysOverLimit,
      grade,
      previousMonthComparison: {
        totalSpent: prevTotalSpent,
        difference: totalSpent - prevTotalSpent
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.post('/goals', async (req, res) => {
  try {
    const { category, monthlyLimit, month: m, year: y } = req.body;
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (typeof monthlyLimit !== 'number' || monthlyLimit < 0) {
      return res.status(400).json({ error: 'Invalid monthlyLimit' });
    }
    const now = new Date();
    const month = m != null ? parseInt(m, 10) : now.getMonth() + 1;
    const year = y != null ? parseInt(y, 10) : now.getFullYear();

    const goal = await BudgetGoal.findOneAndUpdate(
      { userId: req.userId, category, month, year },
      { userId: req.userId, category, monthlyLimit, month, year },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save budget goal' });
  }
});

router.get('/goals', async (req, res) => {
  try {
    const { month, year } = resolveMonthYear(req);
    const goals = await BudgetGoal.find({ userId: req.userId, month, year });
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch budget goals' });
  }
});

router.get('/goals/progress', async (req, res) => {
  try {
    const { month, year } = resolveMonthYear(req);
    const { start, end } = monthDateRange(month, year);

    const [goals, expenses] = await Promise.all([
      BudgetGoal.find({ userId: req.userId, month, year }),
      Expense.find({
        userId: req.userId,
        date: { $gte: start, $lte: end },
      }),
    ]);

    const goalMap = {};
    goals.forEach((g) => {
      goalMap[g.category] = g.monthlyLimit;
    });

    const spentByCategory = CATEGORIES.reduce((acc, c) => {
      acc[c] = 0;
      return acc;
    }, {});
    expenses.forEach((e) => {
      if (spentByCategory[e.category] != null) {
        spentByCategory[e.category] += e.amount;
      }
    });

    const progress = CATEGORIES.map((category) => {
      const limit = goalMap[category] ?? null;
      const spent = spentByCategory[category] || 0;
      let percentage = null;
      let status = 'safe';
      if (limit != null && limit > 0) {
        percentage = Math.min(100, Math.round((spent / limit) * 1000) / 10);
        if (percentage >= 100) status = 'danger';
        else if (percentage >= 80) status = 'warning';
        else status = 'safe';
      } else {
        status = 'none';
      }
      return {
        category,
        limit,
        spent,
        percentage,
        status,
      };
    });

    res.json({ month, year, progress });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch goal progress' });
  }
});

router.put('/allowance', async (req, res) => {
  try {
    const { allowance } = req.body;
    if (typeof allowance !== 'number' || allowance < 0) {
      return res.status(400).json({ error: 'Invalid allowance amount' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.allowance = allowance;
    await user.save();

    syncSmartNotifications(req.userId).catch((err) =>
      console.error('Notification sync after allowance update:', err)
    );

    res.json({ message: 'Allowance updated successfully', allowance: user.allowance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update allowance' });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const { start, end } = monthDateRange(month, year);
      
      const expenses = await Expense.find({
        userId: req.userId,
        date: { $gte: start, $lte: end }
      });
      
      const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
      const monthName = d.toLocaleString('default', { month: 'short' });
      
      months.push({
        month: monthName,
        year,
        total
      });
    }
    
    res.json(months);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
