// Maps Setu AA sandbox FI JSON (ReBIT-style deposit) onto ingest rows.
// Stay on sandbox. Production mode is refused.

function assertSandbox() {
  const env = (process.env.SETU_ENV || 'sandbox').toLowerCase();
  if (env !== 'sandbox') {
    const err = new Error('Setu production mode is disabled; SETU_ENV must be sandbox');
    err.status = 400;
    throw err;
  }
}

function consentHandleFrom(fiData, explicit) {
  if (explicit) return String(explicit);
  if (!fiData || typeof fiData !== 'object') return null;
  return (
    fiData.consentId ||
    fiData.consentID ||
    fiData.consentHandle ||
    fiData.Consent?.id ||
    fiData.Consent?.consentId ||
    null
  );
}

function merchantFromNarration(narration) {
  const n = String(narration || '').trim();
  if (!n) return 'Unknown';
  const upi = n.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z]+)/);
  const parts = n
    .split(/[/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const skip = /^(UPI|DR|CR|DEBIT|CREDIT|NEFT|IMPS|OTHERS|ATM)$/i;
  const named = parts.find((p) => /[A-Za-z]{3}/.test(p) && !skip.test(p) && !p.includes('@'));
  if (named) return named.replace(/\s+/g, ' ');
  if (upi) return upi[1].split('@')[0].replace(/[._-]/g, ' ');
  return n.slice(0, 80);
}

function collectAccountBlocks(root) {
  const blocks = [];
  const seen = new Set();

  function visit(node, depth) {
    if (!node || typeof node !== 'object' || depth > 14) return;
    if (seen.has(node)) return;
    seen.add(node);

    if (typeof node.decryptedFI === 'string') {
      try {
        visit(JSON.parse(node.decryptedFI), depth + 1);
      } catch {
        /* ignore non-JSON FI blobs */
      }
    } else if (node.decryptedFI) {
      visit(node.decryptedFI, depth + 1);
    }

    const txns = node.transactions?.transaction;
    if (Array.isArray(txns) && (node.type || node.profile || node.summary || node.linkedAccRef)) {
      blocks.push(node);
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => visit(child, depth + 1));
      else if (value && typeof value === 'object') visit(value, depth + 1);
    }
  }

  visit(root, 0);
  return blocks;
}

function mapTransaction(txn) {
  const type = String(txn.type || 'DEBIT').toUpperCase();
  const amount = parseFloat(String(txn.amount || '0').replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const occurredAt = new Date(txn.transactionTimestamp || txn.valueDate);
  if (Number.isNaN(occurredAt.getTime())) return null;
  const direction = type === 'CREDIT' ? 'credit' : 'debit';
  const signedAmount = direction === 'debit' ? amount : -amount;
  const merchant = merchantFromNarration(txn.narration);
  return {
    direction,
    amount,
    signedAmount,
    merchant,
    occurredAt,
    rawText: txn.narration || JSON.stringify(txn),
  };
}

function parseSetuFiData(fiData) {
  assertSandbox();
  if (!fiData || typeof fiData !== 'object') {
    const err = new Error('Setu FI payload must be a JSON object');
    err.status = 400;
    throw err;
  }

  const parsed = [];
  for (const account of collectAccountBlocks(fiData)) {
    const list = account.transactions?.transaction || [];
    for (const txn of list) {
      const row = mapTransaction(txn);
      if (row) parsed.push(row);
    }
  }
  return parsed;
}

module.exports = {
  assertSandbox,
  consentHandleFrom,
  parseSetuFiData,
  merchantFromNarration,
};
