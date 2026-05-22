import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ParsedBankSms, SmsLogEntry } from '@/src/types/sms';

export const STORAGE_KEYS = {
  processedSmsIds: 'processedSmsIds',
  autoSmsEnabled: 'allowanceai_autoSmsEnabled',
  pendingQueue: 'allowanceai_pendingSmsQueue',
  smsLog: 'allowanceai_smsLog',
} as const;

type PersistedParsed = Omit<ParsedBankSms, 'raw'>;

export async function loadProcessedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.processedSmsIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveProcessedIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.processedSmsIds, JSON.stringify(ids));
}

export async function loadAutoSmsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEYS.autoSmsEnabled);
  if (v === null) return true;
  return v === 'true';
}

export async function saveAutoSmsEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.autoSmsEnabled, on ? 'true' : 'false');
}

export async function loadPendingQueue(): Promise<PersistedParsed[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.pendingQueue);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePendingQueue(items: PersistedParsed[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.pendingQueue, JSON.stringify(items));
}

export async function loadSmsLog(): Promise<SmsLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.smsLog);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSmsLog(entries: SmsLogEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.smsLog, JSON.stringify(entries));
}

export function toPersistedParsed(p: ParsedBankSms): PersistedParsed {
  const { raw: _r, ...rest } = p;
  return rest;
}

export function mergeParsedFromPersisted(p: PersistedParsed): ParsedBankSms {
  return { ...p };
}
