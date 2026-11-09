// Phase 3 — dashboard aggregation against live Postgres, with and without Redis.
//
// The aggregate has to agree with the conventions Phase 2 established, and all three
// ways of getting that wrong are silent — you get a plausible wrong number, not an error:
//   * a credit (negative amount) must not count as spend
//   * an is_duplicate_flag row must not count, or Phase 2's duplicate detection is undone
//   * last month's spend must not leak into this month's total
//
// The last test is the one that matters in production: render.yaml provisions no Redis.
// With REDIS_URL unset the endpoint must return the same numbers from PostgreSQL, not 500.

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

const authRoutes = require('../routes/auth');
const categoryRoutes = require('../routes/categories');
const budgetRoutes = require('../routes/budgets');
const goalRoutes = require('../routes/goals');
const transactionRoutes = require('../routes/transactions');
const dashboardRoutes = require('../routes/dashboard');
const { cacheQuit, resetCacheState } = require('../config/redis');

const stamp = `${Date.now()}-${process.pid}`;

async function readJson(res) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
}

describe('Phase 3 — dashboard summary against live Postgres', () => {
  let server;
  let baseUrl;
  let verifyClient;
  const userIds = [];

  async function makeUser(label) {
    const res = await readJson(
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `dash-${label}-${stamp}@example.com`,
          password: 'correcthorse8',
        }),
      })
    );
    assert.equal(res.status, 201, res.text);
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
        }).then(readJson),
    };
  }

  /** A date inside the current month, so tests do not break on the 1st. */
  function thisMonth(dayOffsetFromStart = 0, hour = 9) {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1 + dayOffsetFromStart, hour)
    ).toISOString();
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
    app.use('/api/categories', categoryRoutes);
    app.use('/api/budgets', budgetRoutes);
    app.use('/api/goals', goalRoutes);
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

  test('month spend counts debits only, ignoring credits and duplicate-flagged rows', async () => {
    const user = await makeUser('spend');

    // Two real spends.
    for (const [amount, merchant] of [[300, 'Canteen'], [150, 'Metro Card']]) {
      const r = await user.api('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ amount, merchant, direction: 'debit', occurredAt: thisMonth(1) }),
      });
      assert.equal(r.status, 201, r.text);
    }

    // A credit — money in. Must not register as spend.
    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 5000,
        merchant: 'Allowance',
        direction: 'credit',
        occurredAt: thisMonth(1),
      }),
    });

    // A hand-keyed repeat of the 300 spend -> flagged duplicate, must not be counted.
    const dupe = await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 300,
        merchant: 'Canteen',
        direction: 'debit',
        occurredAt: thisMonth(1, 11),
      }),
    });
    assert.equal(dupe.status, 201, dupe.text);
    assert.ok(dupe.body.duplicateOf, 'the repeat was flagged as a duplicate');

    const res = await user.api('/api/dashboard/summary');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.spend.month, 450, 'only the two genuine debits count');
    assert.equal(res.body.spend.transactionCount, 2);

    // Cross-check the same number with literal SQL.
    const sql = await verifyClient.$queryRawUnsafe(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions ' +
        'WHERE user_id = $1::uuid AND is_duplicate_flag = false AND amount > 0 ' +
        "AND occurred_at >= date_trunc('month', now())",
      user.id
    );
    assert.equal(Number(sql[0].total), 450, 'the API agrees with raw SQL');
  });

  test('last month spend does not leak into this month', async () => {
    const user = await makeUser('window');

    const now = new Date();
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 10)
    ).toISOString();

    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 9999,
        merchant: 'Old Spend',
        direction: 'debit',
        occurredAt: lastMonth,
      }),
    });
    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 25,
        merchant: 'New Spend',
        direction: 'debit',
        occurredAt: thisMonth(0, 10),
      }),
    });

    const res = await user.api('/api/dashboard/summary');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.spend.month, 25, "last month's 9999 is excluded");
    // ...but it is still the user's data, so it shows in recent transactions.
    assert.ok(
      res.body.recentTransactions.some((t) => t.merchant === 'Old Spend'),
      'recent transactions are not month-scoped'
    );
  });

  test('budget progress is computed per category, and goal progress as a percentage', async () => {
    const user = await makeUser('budget');

    const cat = await user.api('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: `Food-${stamp}` }),
    });
    assert.equal(cat.status, 201, cat.text);

    const budget = await user.api('/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId: cat.body.id, amount: 1000, period: 'monthly' }),
    });
    assert.equal(budget.status, 201, budget.text);

    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 750,
        merchant: 'Canteen',
        categoryId: cat.body.id,
        direction: 'debit',
        occurredAt: thisMonth(2),
      }),
    });

    const goal = await user.api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: 'New headphones', targetAmount: 4000, currentAmount: 1000 }),
    });
    assert.equal(goal.status, 201, goal.text);

    const res = await user.api('/api/dashboard/summary');
    assert.equal(res.status, 200, res.text);

    const b = res.body.budgets.find((x) => x.id === budget.body.id);
    assert.ok(b, 'the budget is in the summary');
    assert.equal(b.amount, 1000);
    assert.equal(b.spent, 750);
    assert.equal(b.remaining, 250);
    assert.equal(b.percentUsed, 75);
    assert.equal(b.overBudget, false);

    const g = res.body.goals.find((x) => x.id === goal.body.id);
    assert.ok(g, 'the goal is in the summary');
    assert.equal(g.percent, 25, '1000 of 4000');
  });

  test('a new transaction invalidates the cache, so the dashboard is not stale', async () => {
    const user = await makeUser('cache');

    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 100,
        merchant: 'First',
        direction: 'debit',
        occurredAt: thisMonth(3),
      }),
    });

    const first = await user.api('/api/dashboard/summary');
    assert.equal(first.status, 200, first.text);
    assert.equal(first.body.spend.month, 100);

    // Adding a transaction must bust the cached summary.
    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 50,
        merchant: 'Second',
        direction: 'debit',
        occurredAt: thisMonth(3, 14),
      }),
    });

    const second = await user.api('/api/dashboard/summary');
    assert.equal(second.status, 200, second.text);
    assert.equal(
      second.body.spend.month,
      150,
      'the summary reflects the new transaction immediately, not after the 60s TTL'
    );

    // Only meaningful where a Redis is actually reachable. CI provisions none, and
    // neither does Render, so this is conditional rather than skipped — without it the
    // whole cache could be silently dead and every assertion above would still pass.
    if (process.env.REDIS_URL) {
      const third = await user.api('/api/dashboard/summary');
      assert.equal(third.status, 200, third.text);
      assert.equal(third.body.cached, true, 'the second read of unchanged data is a cache hit');
      assert.equal(third.body.spend.month, 150, 'and the cached copy carries the right number');

      const fresh = await user.api('/api/dashboard/summary?fresh=1');
      assert.equal(fresh.body.cached, false, 'fresh=1 bypasses the cache');
    }
  });

  test('with REDIS_URL unset the endpoint still returns the same numbers from PostgreSQL', async () => {
    // This is production: render.yaml provisions no Redis. A cache miss must degrade to
    // a direct read, never a 500 — the failure mode that took the live login down.
    const user = await makeUser('noredis');

    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 420,
        merchant: 'No Redis Here',
        direction: 'debit',
        occurredAt: thisMonth(4),
      }),
    });

    const withRedis = await user.api('/api/dashboard/summary?fresh=1');
    assert.equal(withRedis.status, 200, withRedis.text);

    const saved = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    await cacheQuit();
    resetCacheState();
    try {
      const without = await user.api('/api/dashboard/summary');
      assert.equal(without.status, 200, `must not 500 without Redis: ${without.text}`);
      assert.equal(without.body.cached, false, 'no cache means every read is a fresh one');
      assert.equal(
        without.body.spend.month,
        withRedis.body.spend.month,
        'the numbers are identical with and without Redis'
      );
      assert.equal(without.body.spend.month, 420);
    } finally {
      if (saved) process.env.REDIS_URL = saved;
      await cacheQuit();
      resetCacheState();
    }
  });
});
