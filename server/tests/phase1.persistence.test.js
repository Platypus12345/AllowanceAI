const { spawnSync } = require('node:child_process');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

// Default matches docker-compose.yml postgres (host 5433 → container 5432).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_1';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai';

const authRoutes = require('../routes/auth');
const budgetRoutes = require('../routes/budgets');

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

describe('Phase 1 — persistence against live Postgres', () => {
  let server;
  let baseUrl;
  let verifyClient;
  const email = `phase1-persist-${Date.now()}-${process.pid}@example.com`;
  const password = 'correcthorse8';
  let userId;
  let budgetId;

  before(async () => {
    const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      encoding: 'utf8',
      shell: true,
    });
    if (migrate.status !== 0) {
      throw new Error(
        `prisma migrate deploy failed (is docker-compose postgres up?).\n` +
          `stdout:\n${migrate.stdout}\nstderr:\n${migrate.stderr}`
      );
    }

    verifyClient = new PrismaClient();
    await verifyClient.$queryRaw`SELECT 1`;

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/budgets', budgetRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      if (verifyClient && userId) {
        await verifyClient.user.delete({ where: { id: userId } }).catch(() => {});
      }
    } finally {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      if (verifyClient) {
        await verifyClient.$disconnect();
      }
    }
  });

  test('register, login, create budget, and read the row back from Postgres', async () => {
    assert.match(
      process.env.DATABASE_URL,
      /^postgresql:\/\//,
      'DATABASE_URL must point at Postgres, not a mock'
    );

    const registerRes = await readJson(
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    assert.equal(registerRes.status, 201, registerRes.text);
    const registered = registerRes.body;
    assert.ok(registered.token);
    assert.equal(registered.user.email, email);
    userId = registered.user.id;

    const userRow = await verifyClient.user.findUnique({ where: { id: userId } });
    assert.ok(userRow, 'registered user missing from users table');
    assert.equal(userRow.email, email);
    assert.ok(userRow.passwordHash);

    const loginRes = await readJson(
      await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    assert.equal(loginRes.status, 200, loginRes.text);
    const loggedIn = loginRes.body;
    assert.ok(loggedIn.token);
    assert.equal(loggedIn.user.id, userId);

    const createRes = await readJson(
      await fetch(`${baseUrl}/api/budgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedIn.token}`,
        },
        body: JSON.stringify({ amount: 15000, period: 'monthly' }),
      })
    );
    assert.equal(createRes.status, 201, createRes.text);
    const created = createRes.body;
    budgetId = created.id;
    assert.equal(Number(created.amount), 15000);

    const listRes = await readJson(
      await fetch(`${baseUrl}/api/budgets`, {
        headers: { Authorization: `Bearer ${loggedIn.token}` },
      })
    );
    assert.equal(listRes.status, 200, listRes.text);
    const listed = listRes.body;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, budgetId);

    const budgetRow = await verifyClient.budget.findUnique({ where: { id: budgetId } });
    assert.ok(budgetRow, 'budget missing from budgets table');
    assert.equal(budgetRow.userId, userId);
    assert.equal(Number(budgetRow.amount), 15000);
    assert.equal(budgetRow.period, 'monthly');

    const raw = await verifyClient.$queryRaw`
      SELECT id::text AS id, user_id::text AS user_id, amount, period
      FROM budgets
      WHERE id = ${budgetId}::uuid
    `;
    assert.equal(raw.length, 1);
    assert.equal(raw[0].user_id, userId);
    assert.equal(Number(raw[0].amount), 15000);
  });
});
