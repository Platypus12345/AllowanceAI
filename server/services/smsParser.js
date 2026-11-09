// Unit-testable SMS parser (no Expo). Synthetic bank/UPI copy only.

const MERCHANT_REGEX =
  /(?:at|to|from|via|by)\s+([A-Za-z0-9\s\-_.]+?)(?:\s+on|\s+ref|\s+upi|\.|\s+Acct|\s+UPI|\s+via)/i;
const UPI_REGEX = /([a-zA-Z0-9.\-_]+@[a-zA-Z]+)/;
const BANK_HINTS =
  /\b(HDFC|SBI|ICICI|AXIS|KOTAK|YES\s*BANK|BOI|PUNJAB\s*NATIONAL|PNB|UNION|PAYTM|GPAY|PHONEPE|AMAZON\s*PAY)\b/i;

const BANK_SENDER_IDS = [
  'HDFCBK',
  'SBIINB',
  'ICICIB',
  'AXISBK',
  'KOTAKB',
  'PAYTM',
  'GPAY',
  'PHONEPE',
  'AMAZON',
  'YESBNK',
  'BOIIND',
  'PNBSMS',
  'UNIONB',
  'IDBIBK',
  'BARB0',
];

const BANK_SENDER_PREFIXES = ['VK-', 'VM-', 'VD-', 'BP-', 'AD-'];

function isLikelyBankSender(address) {
  const a = (address || '').toUpperCase().replace(/\s/g, '');
  if (!a) return false;
  if (BANK_SENDER_PREFIXES.some((p) => a.startsWith(p.toUpperCase()))) return true;
  return BANK_SENDER_IDS.some((id) => a.includes(id));
}

function parseAmount(match) {
  if (!match) return null;
  const n = parseFloat(match.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function detectType(body) {
  const b = body.toLowerCase();
  if (/\b(refund|reversed|cashback|returned)\b/i.test(b)) return 'refund';
  if (/\b(debited|debit|spent|paid|withdrawn|deducted)\b/i.test(b)) return 'debit';
  if (/\b(credited|credit|received|deposited|added to)\b/i.test(b)) return 'credit';
  return null;
}

function withoutBalanceTail(body) {
  return body.replace(/\b(?:avl(?:ailable)?\.?\s*bal(?:ance)?|available balance)\b[\s\S]*$/i, '');
}

function extractAmountForType(body, type) {
  const focused = withoutBalanceTail(body);
  const verbs =
    type === 'debit'
      ? 'debited|debit|spent|paid|withdrawn|deducted'
      : type === 'credit'
        ? 'credited|credit|received|deposited'
        : 'refund|reversed|cashback|returned';
  const before = focused.match(
    new RegExp(`(?:INR|Rs\\.?|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s*(?:${verbs})`, 'i')
  );
  if (before?.[1]) return parseAmount(before[1]);
  const after = focused.match(
    new RegExp(`(?:${verbs}).*?(?:INR|Rs\\.?|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i')
  );
  if (after?.[1]) return parseAmount(after[1]);
  const generic = focused.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  return generic ? parseAmount(generic[1]) : null;
}

function extractMerchant(body, upiId) {
  const mer = body.match(MERCHANT_REGEX);
  if (mer?.[1]) return mer[1].trim().replace(/\s+/g, ' ');
  if (upiId) {
    const user = upiId.split('@')[0];
    return user?.replace(/[._-]/g, ' ') || 'Unknown';
  }
  const bank = body.match(BANK_HINTS);
  return bank?.[1]?.trim() || 'Transaction';
}

function extractBankName(body, sender) {
  const m = body.match(BANK_HINTS);
  if (m?.[1]) return m[1].replace(/\s+/g, ' ');
  const s = sender.toUpperCase();
  for (const id of BANK_SENDER_IDS) {
    if (s.includes(id)) return id;
  }
  return undefined;
}

/**
 * @returns {null | {
 *   direction: 'debit' | 'credit' | 'refund',
 *   amount: number,
 *   signedAmount: number,
 *   merchant: string,
 *   occurredAt: Date,
 *   rawText: string,
 *   sender: string,
 *   upiId?: string,
 *   bankName?: string
 * }}
 */
function parseSMS(smsBody, sender, receivedAt) {
  if (!smsBody || !isLikelyBankSender(sender)) return null;

  const type = detectType(smsBody);
  if (!type) return null;

  const amount = extractAmountForType(smsBody, type);
  if (amount == null || amount <= 0) return null;

  const upiMatch = smsBody.match(UPI_REGEX);
  const upiId = upiMatch?.[1];
  const merchant = extractMerchant(smsBody, upiId);
  const occurredAt = receivedAt ? new Date(receivedAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) return null;

  const signedAmount = type === 'debit' ? amount : -amount;

  return {
    direction: type,
    amount,
    signedAmount,
    merchant,
    occurredAt,
    rawText: smsBody,
    sender,
    upiId: upiId || undefined,
    bankName: extractBankName(smsBody, sender),
  };
}

module.exports = { parseSMS, isLikelyBankSender };
