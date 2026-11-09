const prisma = require('../config/prisma');
const { parseSMS } = require('./smsParser');
const { parseSetuFiData, consentHandleFrom, assertSandbox } = require('./setuAdapter');

const DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

function normalizeMerchant(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/@[a-z0-9.]+/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function merchantsMatch(a, b) {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

async function ensureLinkedAccount(userId, source, consentHandle) {
  if (source === 'setu_aa' && consentHandle) {
    const existing = await prisma.linkedAccount.findFirst({
      where: { userId, source, consentHandle },
    });
    if (existing) return existing;
    return prisma.linkedAccount.create({
      data: { userId, source, consentHandle, status: 'active' },
    });
  }

  const existing = await prisma.linkedAccount.findFirst({
    where: { userId, source },
  });
  if (existing) return existing;
  return prisma.linkedAccount.create({
    data: { userId, source, consentHandle: consentHandle || null, status: 'active' },
  });
}

async function findDuplicate(userId, signedAmount, merchant, occurredAt) {
  const t = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
  const windowStart = new Date(t.getTime() - DUPLICATE_WINDOW_MS);
  const windowEnd = new Date(t.getTime() + DUPLICATE_WINDOW_MS);
  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      isDuplicateFlag: false,
      occurredAt: { gte: windowStart, lte: windowEnd },
    },
  });
  return candidates.find(
    (row) =>
      Number(row.amount) === Number(signedAmount) && merchantsMatch(row.merchant, merchant)
  );
}

async function persistParsed(userId, source, linkedAccount, parsed) {
  const duplicateOf = await findDuplicate(
    userId,
    parsed.signedAmount,
    parsed.merchant,
    parsed.occurredAt
  );
  const row = await prisma.transaction.create({
    data: {
      userId,
      linkedAccountId: linkedAccount.id,
      amount: parsed.signedAmount,
      merchant: parsed.merchant,
      source,
      rawText: parsed.rawText,
      occurredAt: parsed.occurredAt,
      isDuplicateFlag: Boolean(duplicateOf),
    },
  });
  return { transaction: row, duplicateOf: duplicateOf ? duplicateOf.id : null };
}

async function ingestSms({ userId, sender, body, receivedAt }) {
  const parsed = parseSMS(body, sender, receivedAt);
  if (!parsed) {
    const err = new Error('SMS is not a parsable bank or UPI transaction');
    err.status = 422;
    throw err;
  }
  const linked = await ensureLinkedAccount(userId, 'sms', null);
  return persistParsed(userId, 'sms', linked, parsed);
}

async function saveSetuConsent({ userId, consentHandle }) {
  assertSandbox();
  if (!consentHandle || !String(consentHandle).trim()) {
    const err = new Error('consentHandle is required');
    err.status = 400;
    throw err;
  }
  return ensureLinkedAccount(userId, 'setu_aa', String(consentHandle).trim());
}

async function ingestSetu({ userId, consentHandle, fiData }) {
  assertSandbox();
  const handle = consentHandleFrom(fiData, consentHandle);
  if (!handle) {
    const err = new Error('consentHandle or fiData.consentId is required');
    err.status = 400;
    throw err;
  }
  const parsedRows = parseSetuFiData(fiData);
  if (parsedRows.length === 0) {
    const err = new Error('No transactions found in Setu FI payload');
    err.status = 422;
    throw err;
  }
  const linked = await ensureLinkedAccount(userId, 'setu_aa', handle);
  const results = [];
  for (const parsed of parsedRows) {
    results.push(await persistParsed(userId, 'setu_aa', linked, parsed));
  }
  return { linkedAccount: linked, results };
}

// Manual entry. Until Phase 3 a transaction could only arrive from `/api/ingest/sms` or
// `/api/ingest/setu`, so there was no way to record a cash spend from a browser — and the
// Phase 3 DoD ("adding a transaction updates the dashboard live") had nothing to trigger it.
//
// Deliberately reuses ensureLinkedAccount + findDuplicate rather than writing a bare
// prisma.transaction.create: a manually keyed row that repeats an SMS already ingested is
// exactly the double-count duplicate detection exists to catch, and the sign convention
// (debit positive, credit negative) has to match the parsers or SUMs silently diverge.
async function createManual({ userId, amount, merchant, categoryId, occurredAt, direction, rawText }) {
  const dir = direction === 'credit' ? 'credit' : 'debit';
  const magnitude = Math.abs(Number(amount));
  const signedAmount = dir === 'debit' ? magnitude : -magnitude;
  const when = occurredAt ? new Date(occurredAt) : new Date();

  const linkedAccount = await ensureLinkedAccount(userId, 'manual', null);
  const duplicateOf = await findDuplicate(userId, signedAmount, merchant, when);

  const row = await prisma.transaction.create({
    data: {
      userId,
      linkedAccountId: linkedAccount.id,
      amount: signedAmount,
      merchant: merchant || null,
      categoryId: categoryId || null,
      source: 'manual',
      rawText: rawText || null,
      occurredAt: when,
      isDuplicateFlag: Boolean(duplicateOf),
    },
  });

  return {
    transaction: serializeTransaction(row),
    duplicateOf: duplicateOf ? duplicateOf.id : null,
  };
}

function serializeTransaction(row) {
  if (!row) return row;
  return {
    ...row,
    amount: Number(row.amount),
  };
}

async function listTransactions(userId) {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { occurredAt: 'desc' },
  });
  return rows.map(serializeTransaction);
}

async function spendSumNonDuplicate(userId) {
  const agg = await prisma.transaction.aggregate({
    where: { userId, isDuplicateFlag: false, amount: { gt: 0 } },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount || 0);
}

module.exports = {
  DUPLICATE_WINDOW_MS,
  ingestSms,
  ingestSetu,
  createManual,
  saveSetuConsent,
  listTransactions,
  spendSumNonDuplicate,
  serializeTransaction,
  normalizeMerchant,
};
