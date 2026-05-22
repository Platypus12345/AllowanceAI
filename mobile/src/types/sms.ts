export type SmsTransactionType = 'debit' | 'credit' | 'refund';

export type ParsedBankSms = {
  type: SmsTransactionType;
  amount: number;
  merchant: string;
  upiId?: string;
  bankName?: string;
  last4?: string;
  /** In-memory only; never persist or send to server */
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
