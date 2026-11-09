// Phase 1 leftover (Tracker.md): seed default categories so a new user has system
// categories without creating them by hand.
//
// Runs the real seed function against the real Postgres and checks the rows land, that
// re-running changes nothing (it is run by hand, possibly twice), and that a brand-new
// user sees them through the API without having created anything.

const { spawnSync } = require('node:child_process');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_1';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const authRoutes = require('../routes/auth');
const categoryRoutes = require('../routes/categories');
const {
  DEFAULT_CATEGORIES,
  seedDefaultCategories,
} = require('../scripts/seedDefaultCategories');

const stamp = `${Date.now()}-${process.pid}`;
const quiet = () => {};

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

describe('Phase 1 — default category seed against live Postgres', () => {
  let server;
  let baseUrl;
  let verifyClient;
  const userIds = [];

  before(async () => {
    verifyClient = new PrismaClient();
    try {
      await verifyClient.$queryRawUnsafe('SELECT 1 FROM categories LIMIT 1');
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
      // Leave the seeded defaults in place: they are shared system rows, and this suite
      // may be running alongside others that read them.
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (verifyClient) await verifyClient.$disconnect();
    }
  });

  test('seeding creates every default category as a system row', async () => {
    await seedDefaultCategories({ log: quiet });

    const rows = await verifyClient.$queryRaw`
      SELECT name, user_id, is_default
      FROM categories
      WHERE is_default = true AND user_id IS NULL
      ORDER BY name
    `;

    for (const name of DEFAULT_CATEGORIES) {
      const row = rows.find((r) => r.name === name);
      assert.ok(row, `default category "${name}" missing from categories table`);
      assert.equal(row.user_id, null, `"${name}" must be a system row, not owned by a user`);
      assert.equal(row.is_default, true);
    }
  });

  test('re-running the seed is a no-op, not a duplicate', async () => {
    await seedDefaultCategories({ log: quiet });
    const before = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n FROM categories WHERE is_default = true AND user_id IS NULL
    `;

    const result = await seedDefaultCategories({ log: quiet });

    const after = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n FROM categories WHERE is_default = true AND user_id IS NULL
    `;
    assert.equal(after[0].n, before[0].n, 'a second seed run must not add rows');
    assert.deepEqual(result.created, [], 'second run should report nothing created');

    // And no default name appears twice.
    const dupes = await verifyClient.$queryRaw`
      SELECT name, COUNT(*)::int AS n
      FROM categories
      WHERE is_default = true AND user_id IS NULL
      GROUP BY name
      HAVING COUNT(*) > 1
    `;
    assert.deepEqual(dupes, [], 'seeded defaults must be unique by name');
  });

  test('a brand-new user sees the defaults without creating anything', async () => {
    await seedDefaultCategories({ log: quiet });

    const reg = await readJson(
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `seed-newuser-${stamp}@example.com`,
          password: 'correcthorse8',
        }),
      })
    );
    assert.equal(reg.status, 201, reg.text);
    userIds.push(reg.body.user.id);

    const listed = await readJson(
      await fetch(`${baseUrl}/api/categories`, {
        headers: { Authorization: `Bearer ${reg.body.token}` },
      })
    );
    assert.equal(listed.status, 200, listed.text);

    const names = listed.body.map((c) => c.name);
    for (const name of DEFAULT_CATEGORIES) {
      assert.ok(names.includes(name), `new user cannot see default category "${name}"`);
    }

    // The user owns none of them — they are shared system rows.
    assert.equal(
      listed.body.filter((c) => c.isDefault).every((c) => c.userId === null),
      true,
      'default categories must not be attributed to the new user'
    );
  });

  test('--dry-run reports what is missing without writing', async () => {
    // Remove one default so there is something to report, then confirm dry-run leaves it out.
    const victim = DEFAULT_CATEGORIES[0];
    await verifyClient.category.deleteMany({
      where: { name: victim, isDefault: true, userId: null },
    });

    const result = await seedDefaultCategories({ dryRun: true, log: quiet });
    assert.deepEqual(result.created, [], 'dry run must create nothing');
    assert.ok(
      result.wouldCreate.includes(victim),
      `dry run should report "${victim}" as missing`
    );

    const stillGone = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM categories
      WHERE name = ${victim} AND is_default = true AND user_id IS NULL
    `;
    assert.equal(stillGone[0].n, 0, 'dry run must not have written the row');

    // Put it back so the suite leaves the database as it found it.
    await seedDefaultCategories({ log: quiet });
    const restored = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM categories
      WHERE name = ${victim} AND is_default = true AND user_id IS NULL
    `;
    assert.equal(restored[0].n, 1, 'teardown failed to restore the seeded default');
  });
});
