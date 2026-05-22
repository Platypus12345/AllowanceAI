import type { ParsedBankSms } from '@/src/types/sms';

/** Registered only on Android; same id used by expo-task-manager. */
export const SMS_BACKGROUND_TASK = 'allowanceai_sms_background_poll';

export async function scanInboxForNewTransactions(
  _processedIds: Set<string>,
  _pendingIds: Set<string>
): Promise<ParsedBankSms[]> {
  return [];
}

export async function registerSmsBackgroundFetch(): Promise<void> {}

export async function unregisterSmsBackgroundFetch(): Promise<void> {}

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function notifyNewBankSms(_item: ParsedBankSms): Promise<void> {}
