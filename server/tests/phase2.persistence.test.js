const { spawnSync } = require('node:child_process');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_1';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai';
process.env.SETU_ENV = 'sandbox';

const authRoutes = require('../routes/auth');
const ingestRoutes = require('../routes/ingest');
const transactionRoutes = require('../routes/transactions');
const { spendSumNonDuplicate } = require('../services/ingestService');

const smsFixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'sms.synthetic.json'), 'utf8')
);
const setuFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'setu-aa.sandbox.synthetic.json'), 'utf8')
);

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

describe('Phase 2 — ingestion persistence against live Postgres', () => {
  let server;
  let baseUrl;
  let verifyClient;
  const email = `phase2-ingest-${Date.now()}-${process.pid}@example.com`;
  const password = 'correcthorse8';
  let userId;
  let token;

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
    app.use('/api/ingest', ingestRoutes);
    app.use('/api/transactions', transactionRoutes);

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

  test('SMS and Setu AA ingest persist, read back, and flag duplicates', async () => {
    const registerRes = await readJson(
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    assert.equal(registerRes.status, 201, registerRes.text);
    userId = registerRes.body.user.id;
    token = registerRes.body.token;

    const smsRes = await readJson(
      await fetch(`${baseUrl}/api/ingest/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(smsFixtures.debit),
      })
    );
    assert.equal(smsRes.status, 201, smsRes.text);
    assert.equal(smsRes.body.source, 'sms');
    assert.equal(Number(smsRes.body.amount), 349);
    assert.ok(smsRes.body.rawText);
    assert.equal(smsRes.body.isDuplicateFlag, false);
    const smsId = smsRes.body.id;

    const listSms = await readJson(
      await fetch(`${baseUrl}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    assert.equal(listSms.status, 200, listSms.text);
    assert.equal(listSms.body.length, 1);
    assert.equal(listSms.body[0].id, smsId);

    const smsRow = await verifyClient.transaction.findUnique({ where: { id: smsId } });
    assert.ok(smsRow, 'SMS transaction missing from transactions table');
    assert.equal(smsRow.source, 'sms');
    assert.equal(smsRow.userId, userId);
    assert.ok(smsRow.rawText);
    assert.ok(smsRow.linkedAccountId);

    const smsAccount = await verifyClient.linkedAccount.findUnique({
      where: { id: smsRow.linkedAccountId },
    });
    assert.equal(smsAccount.source, 'sms');

    // DoD 3: second read-back as a literal SQL SELECT, not just the Prisma model API.
    const smsRaw = await verifyClient.$queryRaw`
      SELECT t.id::text AS id, t.user_id::text AS user_id, t.amount, t.source,
             t.raw_text, t.is_duplicate_flag, la.source AS account_source
      FROM transactions t
      JOIN linked_accounts la ON la.id = t.linked_account_id
      WHERE t.id = ${smsId}::uuid
    `;
    assert.equal(smsRaw.length, 1, 'raw SELECT found no SMS transaction row');
    assert.equal(smsRaw[0].user_id, userId);
    assert.equal(smsRaw[0].source, 'sms');
    assert.equal(Number(smsRaw[0].amount), 349);
    assert.ok(smsRaw[0].raw_text, 'raw_text must be populated on the SMS row');
    assert.equal(smsRaw[0].is_duplicate_flag, false);
    assert.equal(smsRaw[0].account_source, 'sms');

    const consentRes = await readJson(
      await fetch(`${baseUrl}/api/ingest/setu/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ consentHandle: setuFixture.consentId }),
      })
    );
    assert.equal(consentRes.status, 201, consentRes.text);
    assert.equal(consentRes.body.consentHandle, setuFixture.consentId);
    assert.equal(consentRes.body.source, 'setu_aa');

    const setuRes = await readJson(
      await fetch(`${baseUrl}/api/ingest/setu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fiData: setuFixture }),
      })
    );
    assert.equal(setuRes.status, 201, setuRes.text);
    assert.equal(setuRes.body.linkedAccount.consentHandle, setuFixture.consentId);
    assert.equal(setuRes.body.transactions.length, 2);

    const aaDebit = setuRes.body.transactions.find((t) => Number(t.amount) === 349);
    const aaCredit = setuRes.body.transactions.find((t) => Number(t.amount) === -2000);
    assert.ok(aaDebit, 'Setu debit missing');
    assert.ok(aaCredit, 'Setu credit missing');
    assert.equal(aaDebit.source, 'setu_aa');
    assert.equal(aaDebit.isDuplicateFlag, true);
    assert.equal(aaDebit.duplicateOf, smsId);
    assert.equal(aaCredit.isDuplicateFlag, false);

    const aaRow = await verifyClient.transaction.findUnique({ where: { id: aaDebit.id } });
    assert.ok(aaRow);
    assert.equal(aaRow.source, 'setu_aa');
    assert.equal(aaRow.isDuplicateFlag, true);

    // DoD 4: consent_handle must be durable in Postgres, not just echoed by the API.
    const aaAccount = await verifyClient.linkedAccount.findUnique({
      where: { id: aaRow.linkedAccountId },
    });
    assert.equal(aaAccount.source, 'setu_aa');
    assert.equal(aaAccount.consentHandle, setuFixture.consentId);

    const aaRaw = await verifyClient.$queryRaw`
      SELECT t.id::text AS id, t.source, t.amount, t.is_duplicate_flag,
             la.consent_handle, la.source AS account_source
      FROM transactions t
      JOIN linked_accounts la ON la.id = t.linked_account_id
      WHERE t.id = ${aaDebit.id}::uuid
    `;
    assert.equal(aaRaw.length, 1, 'raw SELECT found no Setu AA transaction row');
    assert.equal(aaRaw[0].source, 'setu_aa');
    assert.equal(aaRaw[0].consent_handle, setuFixture.consentId);
    assert.equal(aaRaw[0].account_source, 'setu_aa');
    assert.equal(aaRaw[0].is_duplicate_flag, true);

    // DoD 6: both sources live in the SAME transactions table, differing only by source.
    const bySource = await verifyClient.$queryRaw`
      SELECT source, COUNT(*)::int AS n
      FROM transactions
      WHERE user_id = ${userId}::uuid
      GROUP BY source
      ORDER BY source
    `;
    assert.deepEqual(
      bySource,
      [
        { source: 'setu_aa', n: 2 },
        { source: 'sms', n: 1 },
      ],
      'sms and setu_aa rows must coexist in one transactions table'
    );

    const listAll = await readJson(
      await fetch(`${baseUrl}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    assert.equal(listAll.status, 200, listAll.text);
    assert.equal(listAll.body.length, 3);

    const sumAfterAa = await spendSumNonDuplicate(userId);
    assert.equal(sumAfterAa, 349, 'duplicate Setu debit must not increase spend sum');

    const smsAgain = await readJson(
      await fetch(`${baseUrl}/api/ingest/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(smsFixtures.debit),
      })
    );
    assert.equal(smsAgain.status, 201, smsAgain.text);
    assert.equal(smsAgain.body.isDuplicateFlag, true);

    const upiRes = await readJson(
      await fetch(`${baseUrl}/api/ingest/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(smsFixtures.upi),
      })
    );
    assert.equal(upiRes.status, 201, upiRes.text);
    assert.equal(upiRes.body.isDuplicateFlag, false);
    assert.equal(Number(upiRes.body.amount), 120);

    const sumFinal = await spendSumNonDuplicate(userId);
    assert.equal(sumFinal, 469);

    // DoD 5: the same SUM, proven with raw SQL against Postgres.
    const sumRaw = await verifyClient.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE user_id = ${userId}::uuid
        AND is_duplicate_flag = false
        AND amount > 0
    `;
    assert.equal(
      Number(sumRaw[0].total),
      469,
      'non-flagged spend SUM must exclude both duplicates (SMS-repeat and AA cross-source)'
    );

    // And the duplicates really are persisted as flagged rows, not dropped on ingest.
    const flagged = await verifyClient.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM transactions
      WHERE user_id = ${userId}::uuid AND is_duplicate_flag = true
    `;
    assert.equal(flagged[0].n, 2, 'expected exactly two flagged duplicates');
  });
});
