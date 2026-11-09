// Dashboard aggregation — the single read the v2 client needs to paint its landing page.
//
// Spend convention, matching smsParser / setuAdapter / createManual:
//   amount > 0  -> a debit (money out). This is what "spend" means everywhere.
//   amount < 0  -> a credit (money in). Never counted as spend.
// Rows with is_duplicate_flag = true are excluded throughout: that flag exists so the
// same spend arriving twice (SMS then Setu AA, or SMS then hand-keyed) is not counted
// twice, and an aggregate that ignored it would undo Phase 2's whole point.

const prisma = require('../config/prisma');

/** Start/end of the calendar month containing `now`, plus start of that day. */
function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return { start, end, dayStart };
}

function num(value) {
  return Number(value || 0);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function buildSummary(userId, now = new Date()) {
  const { start, end, dayStart } = monthWindow(now);

  const spendWhere = {
    userId,
    isDuplicateFlag: false,
    amount: { gt: 0 },
    occurredAt: { gte: start, lt: end },
  };

  const [monthAgg, todayAgg, byCategory, budgets, goals, recent] = await Promise.all([
    prisma.transaction.aggregate({
      where: spendWhere,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { ...spendWhere, occurredAt: { gte: dayStart, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: spendWhere,
      _sum: { amount: true },
    }),
    prisma.budget.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.goal.findMany({
      where: { userId },
      orderBy: { targetDate: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { userId, isDuplicateFlag: false },
      orderBy: { occurredAt: 'desc' },
      take: 10,
      include: { category: true },
    }),
  ]);

  const spentByCategory = new Map(
    byCategory.map((row) => [row.categoryId, num(row._sum.amount)])
  );

  const budgetRows = budgets.map((b) => {
    const amount = num(b.amount);
    // A budget with no category is an overall cap, so it is measured against all spend.
    const spent = b.categoryId
      ? spentByCategory.get(b.categoryId) || 0
      : num(monthAgg._sum.amount);
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category ? b.category.name : 'Overall',
      period: b.period,
      amount: round2(amount),
      spent: round2(spent),
      remaining: round2(amount - spent),
      percentUsed: amount > 0 ? Math.round((spent / amount) * 100) : 0,
      overBudget: spent > amount,
    };
  });

  const goalRows = goals.map((g) => {
    const target = num(g.targetAmount);
    const current = num(g.currentAmount);
    return {
      id: g.id,
      title: g.title,
      targetAmount: round2(target),
      currentAmount: round2(current),
      targetDate: g.targetDate,
      percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
    };
  });

  const totalBudget = budgetRows.reduce((acc, b) => acc + b.amount, 0);
  const monthSpend = num(monthAgg._sum.amount);

  return {
    generatedAt: new Date().toISOString(),
    month: { start: start.toISOString(), end: end.toISOString() },
    spend: {
      month: round2(monthSpend),
      today: round2(num(todayAgg._sum.amount)),
      transactionCount: monthAgg._count._all,
    },
    budgets: budgetRows,
    totals: {
      budgeted: round2(totalBudget),
      remaining: round2(totalBudget - monthSpend),
    },
    goals: goalRows,
    recentTransactions: recent.map((t) => ({
      id: t.id,
      amount: num(t.amount),
      merchant: t.merchant,
      source: t.source,
      categoryName: t.category ? t.category.name : null,
      occurredAt: t.occurredAt,
    })),
  };
}

function cacheKey(userId) {
  return `dashboard:summary:${userId}`;
}

// Call after anything that changes what the summary would say: a new transaction, a
// budget or goal write. Fail-open like the rest of the cache — if Redis is absent this
// is a no-op, and the 60s TTL is the backstop either way.
async function invalidateSummary(userId) {
  const { cacheDel } = require('../config/redis');
  return cacheDel(cacheKey(userId));
}

module.exports = { buildSummary, cacheKey, monthWindow, invalidateSummary };
