// Phase 1 leftover (Tracker.md): prove Google OAuth actually persists a
// `users.google_id` row in PostgreSQL.
//
// The register/login DoD never covered the OAuth path, so "Google OAuth backed by
// PostgreSQL" was an untested claim. A real browser consent flow cannot run in CI, but the
// part that touches the database is the strategy's verify callback — so this drives that
// exact callback (the one config/passport.js registered, not a copy) with a synthetic
// Google profile, against the real Postgres from docker-compose / the CI pgvector service.
//
// No mocked Prisma, no stubbed strategy, no network call to Google.

const { spawnSync } = require('node:child_process');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bcrypt = require('bcryptjs');
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

// Registers the real GoogleStrategy on the shared passport instance.
const passport = require('passport');
require('../config/passport');

const stamp = `${Date.now()}-${process.pid}`;

/** Minimal shape of what passport-google-oauth20 hands the verify callback. */
function googleProfile({ id, email, name = 'Synthetic Student' }) {
  return {
    id,
    provider: 'google',
    displayName: name,
    emails: email ? [{ value: email, verified: true }] : [],
  };
}

/** Invoke the registered strategy's verify callback and promisify its done(). */
function runVerify(profile) {
  const strategy = passport._strategy('google');
  assert.ok(strategy, 'GoogleStrategy was never registered on passport');
  assert.equal(
    typeof strategy._verify,
    'function',
    'GoogleStrategy has no _verify callback to exercise'
  );

  return new Promise((resolve, reject) => {
    // passport.js sets passReqToCallback: true, so req comes first.
    strategy._verify({}, 'synthetic-access-token', 'synthetic-refresh-token', profile, (err, user) =>
      err ? reject(err) : resolve(user)
    );
  });
}

describe('Phase 1 — Google OAuth persistence against live Postgres', () => {
  let verifyClient;
  const createdUserIds = new Set();

  before(async () => {
    verifyClient = new PrismaClient();

    // Only pay for a migration if the schema is not already there.
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
  });

  after(async () => {
    for (const id of createdUserIds) {
      await verifyClient.user.delete({ where: { id } }).catch(() => {});
    }
    await verifyClient.$disconnect();
    await cacheQuit();
  });

  test('a first-time Google sign-in writes a users row carrying google_id', async () => {
    const googleId = `synthetic-google-id-new-${stamp}`;
    const email = `oauth-new-${stamp}@example.com`;

    const user = await runVerify(googleProfile({ id: googleId, email }));
    assert.ok(user?.id, 'verify callback returned no user');
    createdUserIds.add(user.id);

    assert.equal(user.googleId, googleId);
    assert.equal(user.email, email);
    assert.equal(user.passwordHash, null, 'a Google-only account must have no password hash');

    // Read back through a separate client's model API...
    const row = await verifyClient.user.findUnique({ where: { id: user.id } });
    assert.ok(row, 'user row missing from users table');
    assert.equal(row.googleId, googleId);

    // ...and again as a literal SQL SELECT on the snake_case column the DoD names.
    const raw = await verifyClient.$queryRaw`
      SELECT id::text AS id, email, google_id, password_hash
      FROM users
      WHERE id = ${user.id}::uuid
    `;
    assert.equal(raw.length, 1, 'raw SELECT found no users row for the Google sign-in');
    assert.equal(raw[0].google_id, googleId, 'google_id was not persisted');
    assert.equal(raw[0].email, email);
    assert.equal(raw[0].password_hash, null);
  });

  test('signing in with Google links google_id onto an existing email/password account', async () => {
    const email = `oauth-link-${stamp}@example.com`;
    const googleId = `synthetic-google-id-link-${stamp}`;

    // An account that already exists the password way.
    const existing = await verifyClient.user.create({
      data: { email, passwordHash: await bcrypt.hash('correcthorse8', 10) },
    });
    createdUserIds.add(existing.id);

    const user = await runVerify(googleProfile({ id: googleId, email }));

    assert.equal(user.id, existing.id, 'Google sign-in must reuse the row, not create a second one');
    assert.equal(user.googleId, googleId);

    const raw = await verifyClient.$queryRaw`
      SELECT id::text AS id, google_id, password_hash
      FROM users
      WHERE email = ${email}
    `;
    assert.equal(raw.length, 1, 'email must not be duplicated across auth methods');
    assert.equal(raw[0].google_id, googleId);
    assert.ok(raw[0].password_hash, 'linking Google must not wipe the existing password hash');
  });

  test('a returning Google user is matched by google_id and creates no duplicate', async () => {
    const googleId = `synthetic-google-id-repeat-${stamp}`;
    const email = `oauth-repeat-${stamp}@example.com`;

    const first = await runVerify(googleProfile({ id: googleId, email }));
    createdUserIds.add(first.id);
    const second = await runVerify(googleProfile({ id: googleId, email }));

    assert.equal(second.id, first.id, 'a repeat sign-in must resolve to the same user row');

    const count = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n FROM users WHERE google_id = ${googleId}
    `;
    assert.equal(count[0].n, 1, 'expected exactly one row for this google_id');
  });

  test('a Google profile with no email is rejected rather than stored half-built', async () => {
    const googleId = `synthetic-google-id-noemail-${stamp}`;

    await assert.rejects(
      () => runVerify(googleProfile({ id: googleId, email: null })),
      /No email found in Google profile/
    );

    const count = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n FROM users WHERE google_id = ${googleId}
    `;
    assert.equal(count[0].n, 0, 'a rejected profile must leave no row behind');
  });
});
