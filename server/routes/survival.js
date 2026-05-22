const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Expense = require('../models/Expense');
const verifyJWT = require('../middleware/verifyJWT');
const {
  calculateFinancialHealth,
  getMonthBounds,
  sumTodaySpend,
} = require('../utils/financialHealth');

router.use(verifyJWT);

function getMonthContext() {
  const date = new Date();
  const month = date.getMonth();
  const year = date.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = date.getDate();
  const daysLeft = daysInMonth - daysElapsed + 1;
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, daysInMonth, daysElapsed, daysLeft };
}

router.get('/status', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { monthStart, daysInMonth, daysElapsed, daysLeft } = getMonthBounds();
    const expenses = await Expense.find({
      userId: req.userId,
      date: { $gte: monthStart },
    });

    const allowance = user.allowance || 0;
    const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const spentToday = sumTodaySpend(expenses);

    const finance = calculateFinancialHealth({
      allowance,
      totalSpent: spent,
      spentToday,
      daysLeftInMonth: daysLeft,
      daysElapsed,
      daysInMonth,
    });

    res.json({
      allowance,
      spent,
      remaining: finance.remainingBalance,
      daysLeft: finance.daysLeftInMonth,
      finance,
      health: finance,
      ...finance.survival,
    });
  } catch (error) {
    console.error('Survival status error:', error);
    res.status(500).json({ error: 'Failed to fetch survival status' });
  }
});

module.exports = router;
