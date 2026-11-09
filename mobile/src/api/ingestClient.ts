import { api } from '@/src/api/http';

export type IngestedTransaction = {
  id: string;
  amount: number;
  merchant: string | null;
  source: string;
  isDuplicateFlag: boolean;
  duplicateOf?: string | null;
  rawText?: string | null;
};

export async function ingestSms(payload: {
  sender: string;
  body: string;
  receivedAt?: string | number;
}): Promise<IngestedTransaction> {
  const { data } = await api.post<IngestedTransaction>('/api/ingest/sms', payload);
  return data;
}
