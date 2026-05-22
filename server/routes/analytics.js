const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const Expense = require('../models/Expense');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

function monthDateRange(month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function resolveMonthYear(req) {
  const now = new Date();
  const month = req.query.month != null ? parseInt(req.query.month, 10) : now.getMonth() + 1;
  const year = req.query.year != null ? parseInt(req.query.year, 10) : now.getFullYear();
  return { month, year };
}

function gradeFromSpend(spentPercent) {
  if (spentPercent > 100) return 'F';
  if (spentPercent >= 95) return 'D';
  if (spentPercent >= 85) return 'C';
  if (spentPercent >= 70) return 'B';
  return 'A';
}

function categoryComment(category) {
  const map = {
    Entertainment: 'Touch grass',
    Food: 'Zomato fan',
    Shopping: 'Retail therapy enthusiast',
    Transport: 'Auto rickshaw VIP',
    Health: 'Self-care spender',
    Other: 'Mystery money',
  };
  return map[category] || 'Big spender';
}

router.get('/wrapped', async (req, res) => {
  try {
    const { month, year } = resolveMonthYear(req);
    const { start, end } = monthDateRange(month, year);

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const { start: prevStart, end: prevEnd } = monthDateRange(prevMonth, prevYear);

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const [expenses, prevExpenses] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
      Expense.find({ userId: req.userId, date: { $gte: prevStart, $lte: prevEnd } }),
    ]);

    const totalAllowance = user.allowance || 0;
    const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0);
    const prevTotalSpent = prevExpenses.reduce((acc, e) => acc + e.amount, 0);
    const savedAmount = Math.max(0, totalAllowance - totalSpent);
    const savingsPercent = totalAllowance > 0 ? Math.round((savedAmount / totalAllowance) * 100) : 0;
    const spentPercent = totalAllowance > 0 ? (totalSpent / totalAllowance) * 100 : 0;
    const grade = gradeFromSpend(spentPercent);

    const categoryBreakdown = CATEGORIES.reduce((acc, c) => {
      acc[c] = 0;
      return acc;
    }, {});

    let biggestSplurge = null;
    expenses.forEach((e) => {
      if (categoryBreakdown[e.category] != null) categoryBreakdown[e.category] += e.amount;
      if (!biggestSplurge || e.amount > biggestSplurge.amount) {
        biggestSplurge = {
          description: e.description,
          amount: e.amount,
          date: e.date,
          category: e.category,
        };
      }
    });

    let topCategory = { name: 'Other', amount: 0, percent: 0 };
    Object.entries(categoryBreakdown).forEach(([name, amount]) => {
      if (amount > topCategory.amount) {
        topCategory = {
          name,
          amount,
          percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        };
      }
    });
    topCategory.comment = categoryComment(topCategory.name);

    const daysInMonth = new Date(year, month, 0).getDate();
    const daysWithSpend = new Set(expenses.map((e) => e.date.toISOString().split('T')[0])).size;
    const dailyAverage = daysWithSpend > 0 ? Math.round(totalSpent / daysWithSpend) : 0;

    const weeklyTotals = [0, 0, 0, 0, 0];
    expenses.forEach((e) => {
      const week = Math.min(4, Math.floor((e.date.getDate() - 1) / 7));
      weeklyTotals[week] += e.amount;
    });

    let bestWeek = { weekNumber: 1, amount: weeklyTotals[0], saved: 0 };
    let worstWeek = { weekNumber: 1, amount: weeklyTotals[0], overspent: 0 };
    const weeklyBudget = totalAllowance / 4;

    weeklyTotals.forEach((amt, i) => {
      const wn = i + 1;
      if (amt < bestWeek.amount || (amt === bestWeek.amount && wn < bestWeek.weekNumber)) {
        bestWeek = { weekNumber: wn, amount: amt, saved: Math.max(0, weeklyBudget - amt) };
      }
      if (amt > worstWeek.amount) {
        worstWeek = { weekNumber: wn, amount: amt, overspent: Math.max(0, amt - weeklyBudget) };
      }
    });

    const spentDiff = totalSpent - prevTotalSpent;
    const percentDiff =
      prevTotalSpent > 0 ? Math.round((spentDiff / prevTotalSpent) * 100) : totalSpent > 0 ? 100 : 0;

    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
    const displayName = user.displayName || user.name || 'Student';

    const wrappedPayload = {
      month,
      year,
      monthName,
      totalSpent,
      totalAllowance,
      savedAmount,
      savingsPercent,
      grade,
      topCategory,
      biggestSplurge,
      bestWeek,
      worstWeek,
      dailyAverage,
      totalTransactions: expenses.length,
      streakAchieved: user.currentStreak ?? user.streak ?? 0,
      badgesEarned: (user.badges || []).map((b) => (typeof b === 'string' ? b : b.name)),
      categoryBreakdown,
      comparedToLastMonth: {
        spentDiff,
        percentDiff,
        improved: spentDiff < 0,
      },
    };

    let aiNarrative =
      `${displayName}, ${monthName} was a month of learning. You spent ₹${totalSpent.toLocaleString('en-IN')} and saved ₹${savedAmount.toLocaleString('en-IN')}. Grade: ${grade}.`;

    try {
      const aiRes = await axios.post(`${AI_SERVICE_URL}/wrapped-narrative`, {
        displayName,
        personalityMode: user.aiPersonality || 'supportive',
        stats: wrappedPayload,
      });
      if (aiRes.data?.narrative) aiNarrative = aiRes.data.narrative;
    } catch (err) {
      console.error('Wrapped narrative AI fallback:', err.message);
    }

    res.json({ ...wrappedPayload, aiNarrative });
  } catch (error) {
    console.error('Wrapped error:', error);
    res.status(500).json({ error: 'Failed to generate wrapped' });
  }
});

module.exports = router;
