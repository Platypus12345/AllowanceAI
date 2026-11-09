// Phase 1 leftover (Tracker.md): the persistence DoD only ever covered budgets, so
// "basic CRUD for categories/budgets/goals" was half-proven — the categories and goals
// routes existed but nothing checked their rows actually reached PostgreSQL.
//
// Every write here is read back twice: once through the HTTP API and once as a literal
// SQL SELECT from a separate PrismaClient. Against the real Postgres from docker-compose
// (host 5433) or the CI pgvector service. No mocks.
//
// Also pins down per-user isolation, which no existing test covered: one user's data must
// never appear in another user's list.

const { spawnSync } = require('node:child_process');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
// Budget/goal/ingest writes now invalidate the dashboard cache, which opens a Redis
// connection when REDIS_URL is set. An open client keeps the node:test process alive
// forever, so it is closed here exactly like the Prisma client below.
const { cacheQuit } = require('../config/redis');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_1';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const authRoutes = require('../routes/auth');
const categoryRoutes = require('../routes/categories');
const goalRoutes = require('../routes/goals');

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

describe('Phase 1 — categories & goals persistence against live Postgres', () => {
  let server;
  let baseUrl;
  let verifyClient;
  const userIds = [];

  /** Register a fresh user and return { id, token, api }. */
  async function makeUser(label) {
    const res = await readJson(
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `crud-${label}-${stamp}@example.com`,
          password: 'correcthorse8',
        }),
      })
    );
    assert.equal(res.status, 201, res.text);
    userIds.push(res.body.user.id);

    const token = res.body.token;
    return {
      id: res.body.user.id,
      token,
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
    app.use('/api/goals', goalRoutes);

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

  test('a category write reaches the categories table and reads back twice', async () => {
    const user = await makeUser('cat');

    const created = await user.api('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: '  Campus Canteen  ' }),
    });
    assert.equal(created.status, 201, created.text);
    assert.equal(created.body.name, 'Campus Canteen', 'name should be trimmed on write');
    const categoryId = created.body.id;

    // Read-back 1: the HTTP API.
    const listed = await user.api('/api/categories');
    assert.equal(listed.status, 200, listed.text);
    assert.ok(
      listed.body.some((c) => c.id === categoryId),
      'created category missing from GET /api/categories'
    );

    // Read-back 2: literal SQL against the snake_case columns.
    const raw = await verifyClient.$queryRaw`
      SELECT id::text AS id, user_id::text AS user_id, name, is_default
      FROM categories
      WHERE id = ${categoryId}::uuid
    `;
    assert.equal(raw.length, 1, 'raw SELECT found no categories row');
    assert.equal(raw[0].user_id, user.id);
    assert.equal(raw[0].name, 'Campus Canteen');
    assert.equal(raw[0].is_default, false);
  });

  test('a category rename and delete are durable, not just echoed', async () => {
    const user = await makeUser('catedit');

    const created = await user.api('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Metro Card' }),
    });
    assert.equal(created.status, 201, created.text);
    const id = created.body.id;

    const renamed = await user.api(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Metro Pass' }),
    });
    assert.equal(renamed.status, 200, renamed.text);

    const afterRename = await verifyClient.$queryRaw`
      SELECT name FROM categories WHERE id = ${id}::uuid
    `;
    assert.equal(afterRename[0].name, 'Metro Pass', 'rename did not persist');

    const deleted = await user.api(`/api/categories/${id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200, deleted.text);

    const afterDelete = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n FROM categories WHERE id = ${id}::uuid
    `;
    assert.equal(afterDelete[0].n, 0, 'delete did not remove the row');
  });

  test('a goal write reaches the goals table with its amounts and date intact', async () => {
    const user = await makeUser('goal');

    const created = await user.api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Laptop fund',
        targetAmount: 45000,
        currentAmount: 7500,
        targetDate: '2027-06-30',
      }),
    });
    assert.equal(created.status, 201, created.text);
    const goalId = created.body.id;

    // Read-back 1: the HTTP API.
    const listed = await user.api('/api/goals');
    assert.equal(listed.status, 200, listed.text);
    assert.equal(listed.body.length, 1);
    assert.equal(listed.body[0].id, goalId);

    // Read-back 2: literal SQL. Decimal(12,2) must keep its scale, not round to an int.
    const raw = await verifyClient.$queryRaw`
      SELECT id::text AS id, user_id::text AS user_id, title,
             target_amount, current_amount, target_date
      FROM goals
      WHERE id = ${goalId}::uuid
    `;
    assert.equal(raw.length, 1, 'raw SELECT found no goals row');
    assert.equal(raw[0].user_id, user.id);
    assert.equal(raw[0].title, 'Laptop fund');
    assert.equal(Number(raw[0].target_amount), 45000);
    assert.equal(Number(raw[0].current_amount), 7500);
    assert.equal(
      new Date(raw[0].target_date).toISOString().slice(0, 10),
      '2027-06-30',
      'target_date must round-trip as the same calendar day'
    );
  });

  test('a goal progress update persists the new current_amount', async () => {
    const user = await makeUser('goalupd');

    const created = await user.api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: 'Trip fund', targetAmount: 12000 }),
    });
    assert.equal(created.status, 201, created.text);
    assert.equal(Number(created.body.currentAmount), 0, 'currentAmount should default to 0');
    const id = created.body.id;

    const updated = await user.api(`/api/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ currentAmount: 3250.5 }),
    });
    assert.equal(updated.status, 200, updated.text);

    const raw = await verifyClient.$queryRaw`
      SELECT current_amount, target_amount FROM goals WHERE id = ${id}::uuid
    `;
    assert.equal(Number(raw[0].current_amount), 3250.5, 'decimal progress must not be truncated');
    assert.equal(Number(raw[0].target_amount), 12000, 'untouched field must not be clobbered');
  });

  test('one user cannot see or mutate another user’s categories and goals', async () => {
    const alice = await makeUser('alice');
    const bob = await makeUser('bob');

    const aliceCat = await alice.api('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Private Category' }),
    });
    assert.equal(aliceCat.status, 201, aliceCat.text);

    const aliceGoal = await alice.api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: 'Alice Private Goal', targetAmount: 5000 }),
    });
    assert.equal(aliceGoal.status, 201, aliceGoal.text);

    // Bob must not see Alice's rows.
    const bobCats = await bob.api('/api/categories');
    assert.equal(bobCats.status, 200, bobCats.text);
    assert.equal(
      bobCats.body.some((c) => c.id === aliceCat.body.id),
      false,
      "Bob can see Alice's category"
    );

    const bobGoals = await bob.api('/api/goals');
    assert.equal(bobGoals.status, 200, bobGoals.text);
    assert.equal(bobGoals.body.length, 0, "Bob's goal list must not include Alice's goal");

    // Nor mutate them.
    const steal = await bob.api(`/api/categories/${aliceCat.body.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    assert.equal(steal.status, 404, 'editing another user’s category must 404');

    const stealGoal = await bob.api(`/api/goals/${aliceGoal.body.id}`, { method: 'DELETE' });
    assert.equal(stealGoal.status, 404, 'deleting another user’s goal must 404');

    // And the originals are untouched in the database.
    const stillThere = await verifyClient.$queryRaw`
      SELECT name FROM categories WHERE id = ${aliceCat.body.id}::uuid
    `;
    assert.equal(stillThere[0].name, 'Alice Private Category');
  });

  test('a client cannot promote its own category to a system default', async () => {
    // GET /api/categories returns every row with is_default = true, regardless of owner.
    // So if a client may set is_default on its own write, it can publish a category into
    // every other user's list. is_default must be reserved for the seed.
    const alice = await makeUser('escalate');
    const bob = await makeUser('victim');

    const created = await alice.api('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Injected Default', isDefault: true }),
    });
    assert.equal(created.status, 201, created.text);

    const raw = await verifyClient.$queryRaw`
      SELECT is_default FROM categories WHERE id = ${created.body.id}::uuid
    `;
    assert.equal(
      raw[0].is_default,
      false,
      'a client-supplied isDefault must be ignored on write'
    );

    const bobCats = await bob.api('/api/categories');
    assert.equal(
      bobCats.body.some((c) => c.id === created.body.id),
      false,
      "Alice's category leaked into Bob's category list via is_default"
    );
  });
});
