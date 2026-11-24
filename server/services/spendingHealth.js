// Safe-to-spend and safety score — the Phase 3 dashboard metrics.
//
// This is a port of v1's `utils/financialHealth.js`, not a copy. The arithmetic there is
// sound but it is wrapped in a Mongo-shaped loader (`e.date`, `e.amount` over an array of
// Mongoose expense docs), it computes month bounds in local time while the rest of the v2
// dashboard works in UTC, and it carries a defect described below. Kept deliberately pure:
// no Prisma, no Date.now() inside the maths, so every branch is testable without a database.
//
// ── The v1 defect this port fixes ───────────────────────────────────────────────────────
// v1 did:
//     const usageRatio = recommendedDailyLimit > 0 ? spentToday / recommendedDailyLimit : 0;
// `recommendedDailyLimit` is `remaining / daysLeft`, so it goes <= 0 exactly when the user
// has spent their whole allowance. At that point the ternary forces `usageRatio` to 0, so
// `usagePercent` is 0, `getSpendingStatus(0)` returns 'SAFE' and `savingsScore` is 100.
// A user who has blown their entire month's allowance was shown "✅ Safe Spending" with a
// perfect score — the one situation where the warning matters most. It also contradicted
// itself in the same payload, since `monthHealthScore` was correctly 0.
// Here, running out is its own state and is never 'safe'. `phase3.spendingHealth.test.js`
// pins it, and the test fails if the v1 ternary is restored.
//
// ── Why "safe to spend" needs a basis, and what happens without one ─────────────────────
// Safe-to-spend is `money you still have / days left`. That needs a budget figure. v1 read
// `user.allowance` and, if it was unset, computed `0 - spent` — a negative remaining, a
// negative daily limit and a 0 score. A brand-new account that logged one ₹349 coffee would
// therefore render as a financial emergency. So:
//   1. `users.monthly_allowance` when set and positive — the user said what they have.
//   2. otherwise the sum of their monthly budgets — they said what they planned to spend.
//   3. otherwise `basis: null` and every derived figure null, so the client prompts for an
//      allowance instead of inventing a verdict from no data.
// (3) is the honest answer, not a degraded one: there is no safe daily spend when nobody
// has said what there is to spend.

/** Status bands, on today's spend as a percentage of the safe daily limit. */
function statusForUsage(usagePercent) {
  if (usagePercent <= 70) return 'safe';
  if (usagePercent <= 100) return 'moderate';
  if (usagePercent <= 130) return 'tight';
  return 'danger';
}

const STATUS_COPY = {
  safe: {
    label: 'Safe',
    message: "You're spending comfortably within your limit.",
  },
  moderate: {
    label: 'Balanced',
    message: "You're close to your safe daily pace.",
  },
  tight: {
    label: 'Watch out',
    message: "You're spending faster than your safe daily limit.",
  },
  danger: {
    label: 'Slow down',
    message: 'Spending is well above your safe daily limit.',
  },
  exhausted: {
    label: 'Out of budget',
    message: 'You have spent everything budgeted for this month.',
  },
};

/**
 * Days in the UTC month containing `now`, how many have elapsed, and how many remain.
 * `daysLeft` *includes today*, because the question is "what may I spend from now on",
 * and it is clamped to >= 1 so it is never a divide-by-zero on the last day.
 */
function monthDays(now) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();
  return {
    daysInMonth,
    daysElapsed,
    daysLeft: Math.max(1, daysInMonth - daysElapsed + 1),
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * @param {object}  input
 * @param {?number} input.allowance     `users.monthly_allowance`, or null/0 if unset
 * @param {number}  input.totalBudgeted sum of the user's budgets, the fallback basis
 * @param {number}  input.monthSpend    non-duplicate debit spend this month
 * @param {number}  input.todaySpend    non-duplicate debit spend today
 * @param {Date}    input.now
 */
function computeSpendingHealth({
  allowance = null,
  totalBudgeted = 0,
  monthSpend = 0,
  todaySpend = 0,
  now = new Date(),
}) {
  const { daysInMonth, daysElapsed, daysLeft } = monthDays(now);

  const allowanceNum = Number(allowance) || 0;
  const budgetedNum = Number(totalBudgeted) || 0;

  let basis = null;
  let budget = 0;
  if (allowanceNum > 0) {
    basis = 'allowance';
    budget = allowanceNum;
  } else if (budgetedNum > 0) {
    basis = 'budgets';
    budget = budgetedNum;
  }

  // The average is over days *elapsed*, not days in the month: on the 3rd, spending
  // ₹300 is ₹100/day, not ₹10/day. Clamped so day 1 is not a divide-by-zero.
  const avgDailySpend = monthSpend / Math.max(1, daysElapsed);

  if (!basis) {
    // No allowance and no budgets. Report the facts we do have and refuse to score.
    return {
      basis: null,
      budget: null,
      remaining: null,
      daysInMonth,
      daysElapsed,
      daysLeft,
      safeToSpendPerDay: null,
      safeToSpendToday: null,
      spentToday: round2(todaySpend),
      avgDailySpend: round2(avgDailySpend),
      projectedMonthEndBalance: null,
      safetyScore: null,
      status: null,
      statusLabel: null,
      message:
        'Set a monthly allowance, or create a budget, to see your safe daily spend.',
      explain: {
        formula: 'money left ÷ days left (including today) = safe to spend per day',
        calculation: 'No allowance or budget set, so there is nothing to divide.',
      },
    };
  }

  const remaining = budget - monthSpend;
  const exhausted = remaining <= 0;

  // Per-day allocation of what is left. Floored at 0: a negative "safe to spend" is not
  // a meaningful instruction, and the `exhausted` status already carries that news.
  const safeToSpendPerDay = Math.max(0, remaining / daysLeft);

  // What is still spendable *today* after what has already gone out today.
  const safeToSpendToday = Math.max(0, safeToSpendPerDay - todaySpend);

  // Where the month ends if the current pace continues.
  const projectedMonthEndBalance = remaining - avgDailySpend * daysLeft;

  // Safety score: how much of the budget survives, 0-100. Monotonic in `remaining`,
  // so it can never read high while the user is overdrawn.
  const safetyScore = Math.max(0, Math.min(100, Math.round((remaining / budget) * 100)));

  let status;
  let usagePercent;
  if (exhausted) {
    // The v1 bug lived here. Running out is its own state, and it is never 'safe'.
    status = 'danger';
    usagePercent = 100;
  } else {
    // safeToSpendPerDay > 0 is guaranteed here, since remaining > 0 and daysLeft >= 1.
    usagePercent = (todaySpend / safeToSpendPerDay) * 100;
    status = statusForUsage(usagePercent);
  }

  const copy = exhausted ? STATUS_COPY.exhausted : STATUS_COPY[status];

  return {
    basis,
    budget: round2(budget),
    remaining: round2(remaining),
    daysInMonth,
    daysElapsed,
    daysLeft,
    safeToSpendPerDay: round2(safeToSpendPerDay),
    safeToSpendToday: round2(safeToSpendToday),
    spentToday: round2(todaySpend),
    avgDailySpend: round2(avgDailySpend),
    projectedMonthEndBalance: round2(projectedMonthEndBalance),
    safetyScore,
    status,
    statusLabel: copy.label,
    usagePercent: Math.round(usagePercent),
    exhausted,
    message: copy.message,
    // Shown behind a "why am I seeing this?" disclosure. A number a user cannot
    // interrogate is a number they will not trust — and it makes the maths reviewable.
    explain: {
      formula: 'money left ÷ days left (including today) = safe to spend per day',
      calculation: `₹${Math.round(remaining).toLocaleString('en-IN')} ÷ ${daysLeft} ${
        daysLeft === 1 ? 'day' : 'days'
      } = ₹${Math.round(safeToSpendPerDay).toLocaleString('en-IN')}/day`,
      basisLabel:
        basis === 'allowance'
          ? 'Based on your monthly allowance'
          : 'Based on your budgets (no monthly allowance set)',
    },
  };
}

module.exports = { computeSpendingHealth, monthDays, statusForUsage };
