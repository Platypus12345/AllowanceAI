// Phase 3 — safe-to-spend and safety score.
//
// Two halves, on purpose:
//   1. Pure unit tests of the arithmetic. `computeSpendingHealth` takes `now` as an
//      argument and touches no database, so every branch — including "ran out of money"
//      and "no basis at all" — is reachable without contriving database state or waiting
//      for a particular day of the month.
//   2. A persistence test proving the numbers reach `GET /api/dashboard/summary` from
//      real rows in real Postgres, because a correct pure function wired up wrongly is
//      still a broken dashboard.
//
// The headline case is `a user who has spent everything is never reported as safe`. That
// is the v1 defect this port fixes: v1's `usageRatio` ternary forced the ratio to 0 once
// the daily limit went non-positive, which made getSpendingStatus(0) return 'SAFE' with a
// savingsScore of 100. Restoring that ternary in spendingHealth.js fails that test.

const { spawnSync } = require('node:child_process');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_3';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const { computeSpendingHealth, monthDays } = require('../services/spendingHealth');
const authRoutes = require('../routes/auth');
const budgetRoutes = require('../routes/budgets');
const transactionRoutes = require('../routes/transactions');
const dashboardRoutes = require('../routes/dashboard');
const { cacheQuit } = require('../config/redis');

const stamp = `${Date.now()}-${process.pid}`;

// A fixed mid-month day so the expected numbers are arithmetic, not a function of
// when the suite happens to run. 15 June 2026: 30 days, 15 elapsed, 16 left (incl. today).
const MID_JUNE = new Date(Date.UTC(2026, 5, 15, 12));

describe('Phase 3 — safe-to-spend arithmetic (pure, no database)', () => {
  test('days left includes today, and the last day of the month is not a divide by zero', () => {
    assert.deepEqual(monthDays(MID_JUNE), {
      daysInMonth: 30,
      daysElapsed: 15,
      daysLeft: 16,
    });

    // 30 June: one day left, which is today.
    assert.equal(monthDays(new Date(Date.UTC(2026, 5, 30, 23))).daysLeft, 1);

    // February 2028 is a leap year — 29 days, so this also pins the month-length maths.
    assert.equal(monthDays(new Date(Date.UTC(2028, 1, 10))).daysInMonth, 29);

    // The clamp: even an impossible day index cannot produce 0 and divide by zero.
    assert.ok(monthDays(new Date(Date.UTC(2026, 5, 30))).daysLeft >= 1);
  });

  test('safe-to-spend is money left divided by days left, and today is subtracted from today', () => {
    const h = computeSpendingHealth({
      allowance: 10000,
      monthSpend: 2000,
      todaySpend: 100,
      now: MID_JUNE,
    });

    assert.equal(h.basis, 'allowance');
    assert.equal(h.remaining, 8000);
    assert.equal(h.daysLeft, 16);
    assert.equal(h.safeToSpendPerDay, 500); // 8000 / 16
    assert.equal(h.safeToSpendToday, 400); // 500 already allocated today, 100 spent
    assert.equal(h.safetyScore, 80); // 8000 / 10000
    assert.equal(h.status, 'safe'); // 100 of 500 is 20% of the daily limit
    assert.equal(h.exhausted, false);

    // avg daily spend is over days ELAPSED, not days in the month: 2000 over 15 days.
    assert.equal(h.avgDailySpend, 133.33);

    // At 133.33/day for 16 more days, 8000 comfortably survives.
    assert.ok(h.projectedMonthEndBalance > 5000, h.projectedMonthEndBalance);
  });

  test('a user who has spent everything is never reported as safe (the v1 defect)', () => {
    const h = computeSpendingHealth({
      allowance: 5000,
      monthSpend: 5000, // every rupee gone
      todaySpend: 0, // and nothing spent today, which is what fooled v1
      now: MID_JUNE,
    });

    // v1 returned status 'SAFE' with savingsScore 100 for exactly this input, because
    // `recommendedDailyLimit <= 0` forced its usageRatio to 0. These four assertions
    // all fail if that ternary is reintroduced.
    assert.equal(h.exhausted, true);
    assert.equal(h.status, 'danger');
    assert.notEqual(h.status, 'safe');
    assert.equal(h.safetyScore, 0);
    assert.equal(h.statusLabel, 'Out of budget');
    assert.equal(h.safeToSpendPerDay, 0, 'never advise spending money that is gone');

    // Overdrawn is worse still, and must not wrap around to a positive score.
    const over = computeSpendingHealth({
      allowance: 5000,
      monthSpend: 7500,
      todaySpend: 0,
      now: MID_JUNE,
    });
    assert.equal(over.safetyScore, 0);
    assert.equal(over.status, 'danger');
    assert.equal(over.remaining, -2500, 'remaining stays honest even when the score floors');
    assert.equal(over.safeToSpendPerDay, 0);
  });

  test('status bands move with today spend against the daily limit', () => {
    // allowance 16000, nothing spent yet, 16 days left -> 1000/day safe limit.
    const at = (todaySpend) =>
      computeSpendingHealth({ allowance: 16000, monthSpend: 0, todaySpend, now: MID_JUNE })
        .status;

    assert.equal(at(0), 'safe');
    assert.equal(at(700), 'safe'); // exactly 70%, the band edge
    assert.equal(at(701), 'moderate');
    assert.equal(at(1000), 'moderate'); // exactly 100%
    assert.equal(at(1001), 'tight');
    assert.equal(at(1300), 'tight'); // exactly 130%
    assert.equal(at(1301), 'danger');
  });

  test('with no allowance it falls back to monthly budgets, and weekly budgets are excluded', () => {
    const h = computeSpendingHealth({
      allowance: null,
      totalBudgeted: 3200,
      monthSpend: 1200,
      todaySpend: 0,
      now: MID_JUNE,
    });

    assert.equal(h.basis, 'budgets');
    assert.equal(h.budget, 3200);
    assert.equal(h.remaining, 2000);
    assert.equal(h.safeToSpendPerDay, 125); // 2000 / 16
    assert.match(h.explain.basisLabel, /no monthly allowance set/);

    // An allowance always wins over the budget fallback when both exist.
    const both = computeSpendingHealth({
      allowance: 10000,
      totalBudgeted: 3200,
      monthSpend: 0,
      todaySpend: 0,
      now: MID_JUNE,
    });
    assert.equal(both.basis, 'allowance');
    assert.equal(both.budget, 10000);
  });

  test('with neither allowance nor budget it refuses to score instead of reporting an emergency', () => {
    const h = computeSpendingHealth({
      allowance: null,
      totalBudgeted: 0,
      monthSpend: 349, // one coffee on a brand-new account
      todaySpend: 349,
      now: MID_JUNE,
    });

    // v1 computed `0 - 349` here: a negative remaining, a negative daily limit and a
    // score of 0, so a new user's first transaction rendered as a financial emergency.
    assert.equal(h.basis, null);
    assert.equal(h.safetyScore, null);
    assert.equal(h.status, null);
    assert.equal(h.safeToSpendPerDay, null);
    assert.equal(h.remaining, null);
    assert.match(h.message, /Set a monthly allowance/);

    // The facts it does know are still reported.
    assert.equal(h.spentToday, 349);
    assert.equal(h.daysLeft, 16);

    // Zero and negative allowances are treated as unset, not as a budget of zero.
    assert.equal(computeSpendingHealth({ allowance: 0, now: MID_JUNE }).basis, null);
    assert.equal(computeSpendingHealth({ allowance: -500, now: MID_JUNE }).basis, null);
  });
});

describe('Phase 3 — safe-to-spend through the API against live Postgres', () => {
  let server;
  let baseUrl;
  let verifyClient;
  const userIds = [];

  async function makeUser(label) {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `health-${label}-${stamp}@example.com`,
        password: 'correcthorse8',
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    userIds.push(res.body.user.id);
    const token = res.body.token;
    return {
      id: res.body.user.id,
      api: (p, init = {}) =>
        fetch(`${baseUrl}${p}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init.headers || {}),
          },
        }).then(async (r) => {
          const text = await r.text();
          return { status: r.status, body: text ? JSON.parse(text) : null, text };
        }),
    };
  }

  before(async () => {
    verifyClient = new PrismaClient();
    try {
      await verifyClient.$queryRawUnsafe('SELECT 1 FROM users LIMIT 1');
    } catch {
      const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env },
        encoding: 'utf8',
        shell: true,
      });
      if (migrate.status !== 0) {
        throw new Error(
          'prisma migrate deploy failed (is docker-compose postgres up on 5433?).\n' +
            `stdout:\n${migrate.stdout}\nstderr:\n${migrate.stderr}`
        );
      }
    }

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/budgets', budgetRoutes);
    app.use('/api/transactions', transactionRoutes);
    app.use('/api/dashboard', dashboardRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      for (const id of userIds) {
        await verifyClient.user.delete({ where: { id } }).catch(() => {});
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (verifyClient) await verifyClient.$disconnect();
      await cacheQuit();
    }
  });

  test('a brand-new user gets an honest "no basis" health block, not a fake emergency', async () => {
    const user = await makeUser('fresh');

    const res = await user.api('/api/dashboard/summary?fresh=1');
    assert.equal(res.status, 200, res.text);
    assert.ok(res.body.health, 'the summary carries a health block at all');
    assert.equal(res.body.health.basis, null);
    assert.equal(res.body.health.safetyScore, null);
    assert.match(res.body.health.message, /Set a monthly allowance/);
  });

  test('setting an allowance makes safe-to-spend real, and a spend moves it', async () => {
    const user = await makeUser('allowance');

    const set = await user.api('/api/auth/me/allowance', {
      method: 'PUT',
      body: JSON.stringify({ allowance: 12000 }),
    });
    assert.equal(set.status, 200, set.text);

    const before = await user.api('/api/dashboard/summary?fresh=1');
    assert.equal(before.body.health.basis, 'allowance');
    assert.equal(before.body.health.budget, 12000);
    assert.equal(before.body.health.remaining, 12000);
    assert.equal(before.body.health.safetyScore, 100);

    // The safe daily figure must be exactly remaining / days left, computed the same way
    // the service does rather than hardcoded, so this test does not break on the 1st.
    const { daysLeft } = monthDays(new Date());
    assert.equal(
      before.body.health.safeToSpendPerDay,
      Math.round((12000 / daysLeft) * 100) / 100
    );

    // Spend 2000 and the block must move with it.
    const tx = await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 2000, merchant: 'Synthetic Mart', direction: 'debit' }),
    });
    assert.equal(tx.status, 201, tx.text);

    const after = await user.api('/api/dashboard/summary?fresh=1');
    assert.equal(after.body.health.remaining, 10000);
    assert.equal(after.body.health.safetyScore, 83); // 10000/12000 -> 83.33 -> 83
    assert.ok(
      after.body.health.safeToSpendPerDay < before.body.health.safeToSpendPerDay,
      'spending reduces the safe daily figure'
    );
    assert.equal(after.body.health.spentToday, 2000);
  });

  test('a credit and a duplicate-flagged row do not inflate the safety score', async () => {
    const user = await makeUser('conventions');
    await user.api('/api/auth/me/allowance', {
      method: 'PUT',
      body: JSON.stringify({ allowance: 1000 }),
    });

    // A real spend of 400 -> remaining 600, score 60.
    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 400, merchant: 'Chai Point', direction: 'debit' }),
    });

    // A credit must not count as spend, and must not be treated as more allowance.
    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 5000, merchant: 'Pocket money', direction: 'credit' }),
    });

    // A hand-keyed repeat of the 400 -> flagged, and must not be counted twice.
    const dupe = await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 400, merchant: 'Chai Point', direction: 'debit' }),
    });
    assert.equal(dupe.status, 201, dupe.text);
    assert.ok(dupe.body.duplicateOf, 'the repeat was flagged rather than counted');

    const res = await user.api('/api/dashboard/summary?fresh=1');
    assert.equal(res.body.spend.month, 400, 'only the one genuine debit');
    assert.equal(res.body.health.remaining, 600);
    assert.equal(res.body.health.safetyScore, 60);
  });

  test('a monthly budget alone is enough of a basis; a weekly one is not', async () => {
    const monthly = await makeUser('budget-monthly');
    const weekly = await makeUser('budget-weekly');

    // Deliberately no allowance set on either user.
    const mk = (user, period) =>
      user.api('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({ amount: 4000, period }),
      });

    const a = await mk(monthly, 'monthly');
    assert.equal(a.status, 201, a.text);
    const b = await mk(weekly, 'weekly');
    assert.equal(b.status, 201, b.text);

    const mRes = await monthly.api('/api/dashboard/summary?fresh=1');
    assert.equal(mRes.body.health.basis, 'budgets');
    assert.equal(mRes.body.health.budget, 4000);

    // A weekly 4000 is not 4000 of monthly headroom. Counting it would overstate
    // safe-to-spend roughly fourfold, so it must not become the basis.
    const wRes = await weekly.api('/api/dashboard/summary?fresh=1');
    assert.equal(wRes.body.health.basis, null, 'a weekly budget is not a monthly basis');
    assert.equal(wRes.body.health.safetyScore, null);
  });
});
