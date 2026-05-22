const { calculateFinancialHealth } = require('./financialHealth');

/** @deprecated Use calculateFinancialHealth — backward-compatible wrapper */
function calculateSurvival({
  allowance = 0,
  remaining,
  spent = 0,
  spentToday = 0,
  daysLeft = 1,
  daysElapsed = 1,
  daysInMonth = 30,
}) {
  const totalSpent = spent ?? (allowance - (remaining ?? 0));
  const health = calculateFinancialHealth({
    allowance,
    totalSpent,
    spentToday,
    daysLeftInMonth: daysLeft,
    daysElapsed,
    daysInMonth,
  });
  return health.survival;
}

module.exports = { calculateSurvival, calculateFinancialHealth };
