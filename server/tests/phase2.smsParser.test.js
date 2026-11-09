const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { parseSMS } = require('../services/smsParser');

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'sms.synthetic.json'), 'utf8')
);

describe('Phase 2 — SMS parser (no Expo, synthetic fixtures)', () => {
  test('parses a debit bank SMS and a UPI SMS', () => {
    const debit = parseSMS(fixtures.debit.body, fixtures.debit.sender, fixtures.debit.receivedAt);
    assert.equal(debit.direction, 'debit');
    assert.equal(debit.amount, 349);
    assert.equal(debit.signedAmount, 349);
    assert.match(debit.merchant, /synthetic mart/i);
    assert.equal(debit.occurredAt.toISOString(), new Date(fixtures.debit.receivedAt).toISOString());

    const upi = parseSMS(fixtures.upi.body, fixtures.upi.sender, fixtures.upi.receivedAt);
    assert.equal(upi.direction, 'debit');
    assert.equal(upi.amount, 120);
    assert.match(upi.merchant, /cafe/i);
    assert.equal(upi.upiId, 'cafe.demo@okaxis');
    // DoD 1 wants amount, merchant, occurred_at and direction on BOTH fixtures.
    assert.equal(upi.occurredAt.toISOString(), new Date(fixtures.upi.receivedAt).toISOString());
  });

  test('parses credit vs debit', () => {
    const credit = parseSMS(
      fixtures.credit.body,
      fixtures.credit.sender,
      fixtures.credit.receivedAt
    );
    assert.equal(credit.direction, 'credit');
    assert.equal(credit.amount, 2000);
    // Credits are stored negative so a SUM of positive amounts is spend-only.
    assert.equal(credit.signedAmount, -2000);
    assert.match(credit.merchant, /acme payroll/i);
    assert.equal(
      credit.occurredAt.toISOString(),
      new Date(fixtures.credit.receivedAt).toISOString()
    );
  });
});
