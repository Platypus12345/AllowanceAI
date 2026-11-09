// Phase 3 — manual transaction entry against live Postgres.
//
// Why this exists: before this, a transaction could only be created by `/api/ingest/sms`
// or `/api/ingest/setu`. There was no way to record a cash spend from a browser, so the
// Phase 3 DoD ("adding a transaction updates the dashboard live") had nothing to trigger.
//
// The two things worth pinning down, because both fail silently rather than loudly:
//   1. The sign convention. Debit must store POSITIVE and credit NEGATIVE, matching
//      smsParser/setuAdapter. Flip it and every spend SUM quietly disagrees across sources.
//   2. Duplicate detection. A user who keys in a spend their SMS already ingested would
//      otherwise be double-counted — the exact bug Phase 2 added duplicate detection for.
//
// Every write is read back twice: through the API and as a literal SQL SELECT from a
// separate PrismaClient. No mocks.

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
const transactionRoutes = require('../routes/transactions');
const ingestRoutes = require('../routes/ingest');

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

describe('Phase 3 — manual transaction entry against live Postgres', () => {
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
          email: `manualtx-${label}-${stamp}@example.com`,
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
    app.use('/api/transactions', transactionRoutes);
    app.use('/api/ingest', ingestRoutes);

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
    }
  });

  test('a manual debit persists as source=manual with a positive amount, read back twice', async () => {
    const user = await makeUser('debit');

    const created = await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 240.5,
        merchant: '  Campus Canteen  ',
        direction: 'debit',
        occurredAt: '2026-11-10T09:30:00.000Z',
      }),
    });
    assert.equal(created.status, 201, created.text);
    const txId = created.body.transaction.id;
    assert.equal(created.body.transaction.source, 'manual');
    assert.equal(created.body.transaction.amount, 240.5);
    assert.equal(created.body.transaction.merchant, 'Campus Canteen', 'merchant is trimmed');
    assert.equal(created.body.duplicateOf, null);

    // Read-back 1: the API.
    const listed = await user.api('/api/transactions');
    assert.equal(listed.status, 200, listed.text);
    const fromApi = listed.body.find((r) => r.id === txId);
    assert.ok(fromApi, 'the new row appears in GET /api/transactions');
    assert.equal(fromApi.amount, 240.5);

    // Read-back 2: literal SQL from a separate client.
    const rows = await verifyClient.$queryRawUnsafe(
      'SELECT amount, merchant, source, is_duplicate_flag FROM transactions WHERE id = $1::uuid',
      txId
    );
    assert.equal(rows.length, 1, 'exactly one row in Postgres');
    assert.equal(Number(rows[0].amount), 240.5, 'debit is stored POSITIVE');
    assert.equal(rows[0].merchant, 'Campus Canteen');
    assert.equal(rows[0].source, 'manual');
    assert.equal(rows[0].is_duplicate_flag, false);

    // A linked_accounts row is created for the manual source, like the other sources.
    const accts = await verifyClient.$queryRawUnsafe(
      "SELECT source FROM linked_accounts WHERE user_id = $1::uuid AND source = 'manual'",
      user.id
    );
    assert.equal(accts.length, 1, 'manual gets its own linked_accounts row');
  });

  test('a manual credit is stored negative, so it does not count as spend', async () => {
    const user = await makeUser('credit');

    const created = await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 1000, merchant: 'Allowance', direction: 'credit' }),
    });
    assert.equal(created.status, 201, created.text);

    const rows = await verifyClient.$queryRawUnsafe(
      'SELECT amount FROM transactions WHERE id = $1::uuid',
      created.body.transaction.id
    );
    assert.equal(Number(rows[0].amount), -1000, 'credit is stored NEGATIVE');

    // The spend SUM convention (amount > 0) must therefore exclude it.
    const spend = await verifyClient.$queryRawUnsafe(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions ' +
        'WHERE user_id = $1::uuid AND is_duplicate_flag = false AND amount > 0',
      user.id
    );
    assert.equal(Number(spend[0].total), 0, 'a credit adds nothing to spend');
  });

  test('keying in a spend the SMS already ingested is flagged, and does not double-count', async () => {
    const user = await makeUser('dupe');

    const sms = await user.api('/api/ingest/sms', {
      method: 'POST',
      body: JSON.stringify({
        sender: 'AD-HDFCBK',
        body: 'Rs.469.00 debited from a/c XX4417 on 10-11-26 to NOODLE BAR UPI/ref 992831',
        receivedAt: '2026-11-10T13:05:00.000Z',
      }),
    });
    assert.equal(sms.status, 201, sms.text);

    const spendAfterSms = await verifyClient.$queryRawUnsafe(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions ' +
        'WHERE user_id = $1::uuid AND is_duplicate_flag = false AND amount > 0',
      user.id
    );
    const baseline = Number(spendAfterSms[0].total);
    assert.equal(baseline, 469, 'the SMS spend landed');

    // Same spend, keyed in by hand a few minutes later.
    const manual = await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount: 469,
        merchant: 'Noodle Bar',
        direction: 'debit',
        occurredAt: '2026-11-10T13:20:00.000Z',
      }),
    });
    assert.equal(manual.status, 201, manual.text);
    assert.ok(manual.body.duplicateOf, 'the manual row is linked to the SMS row it repeats');

    const flagged = await verifyClient.$queryRawUnsafe(
      'SELECT is_duplicate_flag FROM transactions WHERE id = $1::uuid',
      manual.body.transaction.id
    );
    assert.equal(flagged[0].is_duplicate_flag, true, 'the manual repeat is flagged');

    const spendAfterManual = await verifyClient.$queryRawUnsafe(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions ' +
        'WHERE user_id = $1::uuid AND is_duplicate_flag = false AND amount > 0',
      user.id
    );
    assert.equal(
      Number(spendAfterManual[0].total),
      baseline,
      'non-flagged spend did NOT increase — no double count'
    );
  });

  test('a category belonging to another user is rejected, and nothing is written', async () => {
    const owner = await makeUser('owner');
    const stranger = await makeUser('stranger');

    const cat = await owner.api('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: `Private-${stamp}` }),
    });
    assert.equal(cat.status, 201, cat.text);

    const attempt = await stranger.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 50, merchant: 'X', categoryId: cat.body.id }),
    });
    assert.equal(attempt.status, 400, 'a category owned by another user is not attachable');

    const rows = await verifyClient.$queryRawUnsafe(
      'SELECT id FROM transactions WHERE user_id = $1::uuid',
      stranger.id
    );
    assert.equal(rows.length, 0, 'the rejected request wrote no row at all');
  });

  test('invalid payloads are rejected before anything is written', async () => {
    const user = await makeUser('validation');

    const cases = [
      [{ merchant: 'No amount' }, 'missing amount'],
      [{ amount: 0 }, 'zero amount'],
      [{ amount: 'abc' }, 'non-numeric amount'],
      [{ amount: 10, direction: 'sideways' }, 'bad direction'],
      [{ amount: 10, occurredAt: 'not-a-date' }, 'bad date'],
    ];

    for (const [payload, label] of cases) {
      const res = await user.api('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 400, `${label} should be rejected: ${res.text}`);
    }

    const rows = await verifyClient.$queryRawUnsafe(
      'SELECT id FROM transactions WHERE user_id = $1::uuid',
      user.id
    );
    assert.equal(rows.length, 0, 'no invalid payload created a row');
  });
});
