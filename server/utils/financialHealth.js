/**
 * Centralized financial health engine — ALL widgets must use this only.
 */

function getSpendingStatus(usagePercent) {
  if (usagePercent <= 70) return 'SAFE';
  if (usagePercent <= 100) return 'MODERATE';
  if (usagePercent <= 130) return 'WARNING';
  return 'DANGER';
}

function getStatusMeta(status) {
  const map = {
    SAFE: {
      level: 'low',
      moodLabel: 'Safe Spending',
      insight: "You're spending comfortably within your limit.",
      ringColor: '#44e2cd',
      emoji: '✅',
      trend: 'stable',
    },
    MODERATE: {
      level: 'moderate',
      moodLabel: 'Balanced',
      insight: 'You are close to your recommended daily spending pace.',
      ringColor: '#8083ff',
      emoji: '⚖️',
      trend: 'balanced',
    },
    WARNING: {
      level: 'high',
      moodLabel: 'Watch Out',
      insight: 'You are spending faster than your safe daily limit.',
      ringColor: '#ffb690',
      emoji: '⚠️',
      trend: 'overspending',
    },
    DANGER: {
      level: 'danger',
      moodLabel: 'Dangerous Spending',
      insight: 'Spending is well above your safe daily limit — slow down today.',
      ringColor: '#ffb4ab',
      emoji: '🔴',
      trend: 'overspending',
    },
  };
  return map[status] || map.SAFE;
}

/**
 * Per-day metrics for heatmap tooltips.
 */
function calculateDayMetrics(daySpent, recommendedDailyLimit) {
  if (daySpent <= 0 || recommendedDailyLimit <= 0) {
    const status = 'SAFE';
    const meta = getStatusMeta(status);
    return {
      usagePercent: 0,
      usageRatio: 0,
      savingsScore: 100,
      spendingStatus: status,
      mood: meta.moodLabel,
      moodLabel: meta.moodLabel,
      level: 'none',
    };
  }

  const usageRatio = daySpent / recommendedDailyLimit;
  const usagePercent = usageRatio * 100;
  const spendingStatus = getSpendingStatus(usagePercent);
  const savingsScore = Math.max(0, Math.min(100, Math.round(100 - usagePercent)));
  const meta = getStatusMeta(spendingStatus);

  return {
    usagePercent: Math.round(usagePercent),
    usageRatio,
    savingsScore,
    spendingStatus,
    mood: meta.moodLabel,
    moodLabel: meta.moodLabel,
    level: meta.level,
  };
}

function buildHumanInsights({
  spendingStatus,
  recommendedDailyLimit,
  daysLeftInMonth,
  remainingBalance,
  projectedMonthEndBalance,
  avgDailySpend,
}) {
  const statusMeta = getStatusMeta(spendingStatus);
  const lines = [statusMeta.insight];

  if (recommendedDailyLimit > 0) {
    lines.push(
      `You can safely spend around ₹${Math.round(recommendedDailyLimit).toLocaleString('en-IN')}/day for the rest of the month.`
    );
  }

  if (projectedMonthEndBalance > 100) {
    lines.push(
      'Your current pace suggests you\'ll still have savings left by month end.'
    );
  } else if (projectedMonthEndBalance <= 0) {
    lines.push(
      'At your current burn rate, you may run out of money before the month ends.'
    );
  }

  return {
    mainInsight: statusMeta.insight,
    messages: lines,
    dailyGuidance: recommendedDailyLimit > 0
      ? `Safe daily spending: ₹${Math.round(recommendedDailyLimit).toLocaleString('en-IN')}/day`
      : null,
    summary: `${daysLeftInMonth} days left · ₹${Math.round(remainingBalance).toLocaleString('en-IN')} remaining`,
    burnRateLabel: `₹${Math.round(avgDailySpend).toLocaleString('en-IN')}/day avg burn`,
  };
}

function buildExplainability({ remainingBalance, daysLeftInMonth, recommendedDailyLimit }) {
  const roundedRemaining = Math.round(remainingBalance);
  const roundedLimit = Math.round(recommendedDailyLimit);
  return {
    title: 'Why am I seeing this?',
    formula:
      'Remaining Balance ÷ Days Left = Recommended Daily Limit',
    calculation:
      daysLeftInMonth > 0
        ? `₹${roundedRemaining.toLocaleString('en-IN')} ÷ ${daysLeftInMonth} days = ₹${roundedLimit.toLocaleString('en-IN')}/day`
        : 'No days remaining in this month.',
    inputs: {
      remainingBalance: roundedRemaining,
      daysLeftInMonth,
      recommendedDailyLimit: roundedLimit,
    },
  };
}

function buildTrendIndicator(projectedMonthEndBalance, spendingStatus) {
  const meta = getStatusMeta(spendingStatus);
  if (projectedMonthEndBalance < 0 || spendingStatus === 'DANGER' || spendingStatus === 'WARNING') {
    return { direction: 'up', label: '↑ Overspending', tone: 'warning' };
  }
  if (spendingStatus === 'SAFE') {
    return { direction: 'down', label: '↓ Stable spending', tone: 'safe' };
  }
  return { direction: 'flat', label: '→ Balanced', tone: 'balanced' };
}

/**
 * @param {Object} params
 * @param {number} params.allowance
 * @param {number} params.totalSpent - month total (alias: spent)
 * @param {number} params.spentToday
 * @param {number} params.daysLeftInMonth
 * @param {number} params.daysElapsed
 * @param {number} params.daysInMonth
 */
function calculateFinancialHealth({
  allowance = 0,
  totalSpent,
  spent,
  spentToday = 0,
  daysLeftInMonth,
  daysLeft,
  daysElapsed,
  daysInMonth,
}) {
  const monthSpent = totalSpent ?? spent ?? 0;
  const safeDaysLeft = Math.max(daysLeftInMonth ?? daysLeft ?? 1, 1);
  const safeDaysElapsed = Math.max(daysElapsed ?? 1, 1);
  const safeDaysInMonth = Math.max(daysInMonth ?? 30, 1);

  const remainingBalance = allowance - monthSpent;
  const recommendedDailyLimit = remainingBalance / safeDaysLeft;
  const avgDailySpend = monthSpent / safeDaysElapsed;
  const projectedMonthEndBalance =
    remainingBalance - avgDailySpend * safeDaysLeft;

  const usageRatio =
    recommendedDailyLimit > 0 ? spentToday / recommendedDailyLimit : 0;
  const usagePercent = usageRatio * 100;
  const spendingStatus =
    spentToday <= 0 && monthSpent <= 0
      ? 'SAFE'
      : getSpendingStatus(usagePercent);
  const savingsScore = Math.max(0, Math.min(100, Math.round(100 - usagePercent)));

  const monthHealthScore =
    allowance > 0
      ? Math.max(0, Math.min(100, Math.round((remainingBalance / allowance) * 100)))
      : 0;

  const burnRate = Math.round(avgDailySpend * 10) / 10;
  const statusMeta = getStatusMeta(spendingStatus);
  const trend = buildTrendIndicator(projectedMonthEndBalance, spendingStatus);
  const insights = buildHumanInsights({
    spendingStatus,
    recommendedDailyLimit,
    daysLeftInMonth: safeDaysLeft,
    remainingBalance,
    projectedMonthEndBalance,
    avgDailySpend,
  });
  const explainability = buildExplainability({
    remainingBalance,
    daysLeftInMonth: safeDaysLeft,
    recommendedDailyLimit,
  });

  const rounded = {
    allowance: Math.round(allowance),
    totalSpent: Math.round(monthSpent),
    remainingBalance: Math.round(remainingBalance),
    daysLeftInMonth: safeDaysLeft,
    daysElapsed: safeDaysElapsed,
    daysInMonth: safeDaysInMonth,
    avgDailySpend: Math.round(avgDailySpend),
    recommendedDailyLimit: Math.round(recommendedDailyLimit),
    projectedMonthEndBalance: Math.round(projectedMonthEndBalance),
    spendingStatus,
    savingsScore,
    burnRate,
    spentToday: Math.round(spentToday),
    usagePercent: Math.round(usagePercent),
    usageRatio,
    monthHealthScore,
    insights,
    explainability,
    trend,
  };

  /** Backward-compatible survival shape for existing UI */
  rounded.survival = {
    safetyScore: monthHealthScore,
    status:
      spendingStatus === 'SAFE'
        ? 'safe'
        : spendingStatus === 'MODERATE'
          ? 'moderate'
          : spendingStatus === 'WARNING'
            ? 'tight'
            : 'danger',
    message: insights.mainInsight,
    badgeLabel: spendingStatus,
    paceLabel: statusMeta.moodLabel,
    paceStatus: spendingStatus.toLowerCase(),
    spendingStatus,
    projectedMonthEndBalance: rounded.projectedMonthEndBalance,
    dailyLimit: rounded.recommendedDailyLimit,
    recommendedDailyLimit: rounded.recommendedDailyLimit,
    dailyAverage: rounded.avgDailySpend,
    burnRate: rounded.burnRate,
    ringColor: statusMeta.ringColor,
    emoji: statusMeta.emoji,
    daysLeft: safeDaysLeft,
    remainingBalance: rounded.remainingBalance,
    spentToday: rounded.spentToday,
    usagePercent: rounded.usagePercent,
    savingsScore: rounded.savingsScore,
    insights,
    explainability,
    trend,
    showSurvivingWell: spendingStatus === 'SAFE' || spendingStatus === 'MODERATE',
    leftoverMessage: insights.summary,
    secondaryMessage: insights.dailyGuidance,
  };

  return rounded;
}

function getMonthBounds(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = date.getDate();
  const daysLeftInMonth = daysInMonth - daysElapsed + 1;
  return {
    monthStart,
    daysInMonth,
    daysElapsed,
    daysLeftInMonth,
    daysLeft: daysLeftInMonth,
    year,
    month: month + 1,
  };
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sumTodaySpend(expenses) {
  const todayStart = startOfDay();
  return expenses
    .filter((e) => new Date(e.date) >= todayStart)
    .reduce((acc, e) => acc + e.amount, 0);
}

/** Build health from DB expenses in one call */
function calculateFinancialHealthFromExpenses({
  allowance,
  expenses,
  date = new Date(),
}) {
  const { monthStart, daysInMonth, daysElapsed, daysLeftInMonth } = getMonthBounds(date);
  const monthExpenses = expenses.filter((e) => new Date(e.date) >= monthStart);
  const totalSpent = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
  const spentToday = sumTodaySpend(monthExpenses);

  return calculateFinancialHealth({
    allowance,
    totalSpent,
    spentToday,
    daysLeftInMonth,
    daysElapsed,
    daysInMonth,
  });
}

module.exports = {
  calculateFinancialHealth,
  calculateDayMetrics,
  calculateFinancialHealthFromExpenses,
  getSpendingStatus,
  getMonthBounds,
  sumTodaySpend,
  startOfDay,
};
