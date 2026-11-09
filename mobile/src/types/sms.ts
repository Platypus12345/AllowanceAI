export type SmsTransactionType = 'debit' | 'credit' | 'refund';

export type ParsedBankSms = {
  type: SmsTransactionType;
  amount: number;
  merchant: string;
  upiId?: string;
  bankName?: string;
  last4?: string;
  /** Original SMS body; posted to server ingest so Postgres can store raw_text */
  raw?: string;
  sender: string;
  smsId: string;
  date: number;
  suggestedCategory: string;
};

export type SmsLogStatus = 'pending' | 'added' | 'ignored';

export type SmsLogEntry = {
  id: string;
  amount: number;
  merchant: string;
  type: SmsTransactionType;
  status: SmsLogStatus;
  date: number;
  category?: string;
  description?: string;
  linkedExpenseId?: string;
};
