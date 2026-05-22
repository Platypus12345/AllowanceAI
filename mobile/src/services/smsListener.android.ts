import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import type { ParsedBankSms } from '@/src/types/sms';
import { parseSMS } from '@/src/services/smsParser';
import {
  loadAutoSmsEnabled,
  loadPendingQueue,
  loadProcessedIds,
  savePendingQueue,
  toPersistedParsed,
} from '@/src/services/smsStorage';

export const SMS_BACKGROUND_TASK = 'allowanceai_sms_background_poll';

function getSmsAndroid(): {
  list: (
    filter: string,
    fail: (e: string) => void,
    done: (count: number, smsList: string) => void
  ) => void;
} | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-get-sms-android');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function listInbox(maxCount: number): Promise<Record<string, unknown>[]> {
  const SmsAndroid = getSmsAndroid();
  if (!SmsAndroid) return Promise.resolve([]);

  const filter = {
    box: 'inbox',
    indexFrom: 0,
    maxCount,
  };

  return new Promise((resolve, reject) => {
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => reject(new Error(fail)),
      (_count: number, smsList: string) => {
        try {
          const arr = JSON.parse(smsList);
          resolve(Array.isArray(arr) ? arr : []);
        } catch {
          resolve([]);
        }
      }
    );
  });
}

export async function scanInboxForNewTransactions(
  processedIds: Set<string>,
  pendingIds: Set<string>
): Promise<ParsedBankSms[]> {
  if (Platform.OS !== 'android') return [];

  const enabled = await loadAutoSmsEnabled();
  if (!enabled) return [];

  let rows: Record<string, unknown>[];
  try {
    rows = await listInbox(25);
  } catch {
    return [];
  }

  const found: ParsedBankSms[] = [];

  for (const row of rows) {
    const _id = row._id;
    const body = typeof row.body === 'string' ? row.body : '';
    const address = typeof row.address === 'string' ? row.address : '';
    const date = typeof row.date === 'number' ? row.date : 0;
    const sid = String(_id ?? '');

    if (!sid || processedIds.has(sid) || pendingIds.has(sid)) continue;

    const parsed = parseSMS(body, address, sid, date);
    if (parsed) found.push(parsed);
  }

  return found;
}

async function mergePendingAndMaybeNotify(items: ParsedBankSms[]): Promise<void> {
  if (items.length === 0) return;
  const pending = await loadPendingQueue();
  const existing = new Set(pending.map((p) => p.smsId));
  let changed = false;
  for (const it of items) {
    if (existing.has(it.smsId)) continue;
    existing.add(it.smsId);
    pending.unshift(toPersistedParsed(it));
    changed = true;
  }
  if (changed) await savePendingQueue(pending);
  await notifyNewBankSms(items[0]);
}

TaskManager.defineTask(SMS_BACKGROUND_TASK, async () => {
  try {
    const auto = await loadAutoSmsEnabled();
    if (!auto) return BackgroundFetch.BackgroundFetchResult.NoData;

    const processed = new Set(await loadProcessedIds());
    const pendingQ = await loadPendingQueue();
    const pendingIds = new Set(pendingQ.map((p) => p.smsId));

    const items = await scanInboxForNewTransactions(processed, pendingIds);
    if (items.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

    await mergePendingAndMaybeNotify(items);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerSmsBackgroundFetch(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) return;
  if (status === BackgroundFetch.BackgroundFetchStatus.Denied) return;

  const registered = await TaskManager.isTaskRegisteredAsync(SMS_BACKGROUND_TASK);
  if (registered) return;

  await BackgroundFetch.registerTaskAsync(SMS_BACKGROUND_TASK, {
    minimumInterval: 5 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function unregisterSmsBackgroundFetch(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const registered = await TaskManager.isTaskRegisteredAsync(SMS_BACKGROUND_TASK);
  if (registered) {
    await BackgroundFetch.unregisterTaskAsync(SMS_BACKGROUND_TASK);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function notifyNewBankSms(item: ParsedBankSms): Promise<void> {
  await Notifications.setNotificationChannelAsync('sms-auto', {
    name: 'SMS expense detection',
    importance: Notifications.AndroidImportance.HIGH,
  });

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const symbol = item.type === 'credit' ? '+' : '-';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New transaction detected',
      body: `${symbol}₹${item.amount} ${item.merchant} — Tap to review`,
      data: { smsId: item.smsId, type: 'sms-review' },
    },
    trigger: null,
  });
}
