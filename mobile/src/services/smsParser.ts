import type { ParsedBankSms, SmsTransactionType } from '@/src/types/sms';
import { getMerchantCategory } from '@/src/services/merchantMapper';

const DEBIT_REGEX =
  /(?:debited|debit|spent|paid|withdrawn|deducted).*?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const CREDIT_REGEX =
  /(?:credited|credit|received|deposited|added).*?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const REFUND_REGEX =
  /(?:refund|reversed|cashback|returned).*?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const MERCHANT_REGEX =
  /(?:at|to|from|via|by)\s+([A-Za-z0-9\s\-_.]+?)(?:\s+on|\s+ref|\s+upi|\.|\s+Acct)/i;
const UPI_REGEX = /([a-zA-Z0-9.\-_]+@[a-zA-Z]+)/;
const LAST4_REGEX = /(?:xx|XX|\*{2,}|ending)\s*(\d{4})\b/i;
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

export function isLikelyBankSender(address: string): boolean {
  const a = (address || '').toUpperCase().replace(/\s/g, '');
  if (!a) return false;
  if (BANK_SENDER_PREFIXES.some((p) => a.startsWith(p.toUpperCase()))) return true;
  return BANK_SENDER_IDS.some((id) => a.includes(id));
}

function parseAmount(match: string | undefined): number | null {
  if (!match) return null;
  const n = parseFloat(match.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function detectType(body: string): SmsTransactionType | null {
  const b = body.toLowerCase();
  if (/\b(refund|reversed|cashback|returned)\b/i.test(b)) return 'refund';
  if (/\b(debited|debit|spent|paid|withdrawn|deducted)\b/i.test(b)) return 'debit';
  if (/\b(credited|credit|received|deposited|added to)\b/i.test(b)) return 'credit';
  return null;
}

function extractAmountForType(body: string, type: SmsTransactionType): number | null {
  let m: RegExpMatchArray | null = null;
  if (type === 'debit') m = body.match(DEBIT_REGEX);
  else if (type === 'credit') {
    m = body.match(CREDIT_REGEX);
    if (!m?.[1]) {
      m = body.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?).*?(?:credited|credit|received|deposited)/i);
    }
  } else m = body.match(REFUND_REGEX);
  if (m?.[1]) return parseAmount(m[1]);
  const generic = body.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  return generic ? parseAmount(generic[1]) : null;
}

function extractMerchant(body: string, upiId?: string): string {
  const mer = body.match(MERCHANT_REGEX);
  if (mer?.[1]) return mer[1].trim().replace(/\s+/g, ' ');
  if (upiId) {
    const user = upiId.split('@')[0];
    return user?.replace(/[._-]/g, ' ') || 'Unknown';
  }
  const bank = body.match(BANK_HINTS);
  return bank?.[1]?.trim() || 'Transaction';
}

function extractBankName(body: string, sender: string): string | undefined {
  const m = body.match(BANK_HINTS);
  if (m?.[1]) return m[1].replace(/\s+/g, ' ');
  const s = sender.toUpperCase();
  for (const id of BANK_SENDER_IDS) {
    if (s.includes(id)) return id;
  }
  return undefined;
}

/**
 * Returns null if the message is not a parsable bank / UPI transaction SMS.
 */
export function parseSMS(
  smsBody: string,
  sender: string,
  androidSmsId: string | number,
  dateMs: number
): ParsedBankSms | null {
  if (!isLikelyBankSender(sender)) return null;

  const type = detectType(smsBody);
  if (!type) return null;

  const amount = extractAmountForType(smsBody, type);
  if (amount == null || amount <= 0) return null;

  const upiMatch = smsBody.match(UPI_REGEX);
  const upiId = upiMatch?.[1];
  const merchant = extractMerchant(smsBody, upiId);
  const last4 = smsBody.match(LAST4_REGEX)?.[1];
  const bankName = extractBankName(smsBody, sender);
  const suggestedCategory = getMerchantCategory(merchant);

  return {
    type,
    amount,
    merchant,
    upiId: upiId || undefined,
    bankName,
    last4: last4 || undefined,
    raw: smsBody,
    sender,
    smsId: String(androidSmsId),
    date: dateMs,
    suggestedCategory,
  };
}
